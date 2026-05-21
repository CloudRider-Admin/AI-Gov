/**
 * POST /api/regulations/explain
 *
 * Returns a long-form explainer for a regulation card. PRO+ only.
 *
 * Request body: { regulation: string, article: string, query?: string }
 *
 * Resolution order:
 *   1. Curated library (`REGULATION_LIBRARY_BY_SLUG`) — instant, no LLM call.
 *   2. LLM fallback via OpenAI (Claude on quota failover), grounded in the
 *      app's existing governance knowledge and (when available) the
 *      caller's original advisor query.
 *
 * Successful response shape: `RegulationExplainerResponse`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';

import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitHeaders } from '@/lib/rateLimitHeaders';
import { ResponseCache } from '@/lib/responseCache';
import { openaiCircuit, CircuitOpenError } from '@/lib/circuitBreaker';
import { claudeComplete, isOpenAIQuotaError, isClaudeFallbackAvailable } from '@/lib/ai/claudeFallback';
import { auditLog } from '@/lib/utils/logger';
import { getRegulationEntry, toSlugs } from '@/lib/regulations/lookup';
import type { RegulationEntry } from '@/data/regulationLibrary';
import { getDocumentByCode } from '@/data/govsecureKnowledge';
import type { GovSecureCategory } from '@/types/govsecure';

const PAID_ROLES = new Set(['PRO', 'TEAM', 'ENTERPRISE', 'ADMIN']);

const explainRequestSchema = z.object({
  regulation: z.string().min(1).max(200),
  article: z.string().min(1).max(200),
  query: z.string().max(2000).optional(),
});

export interface RelatedDoc {
  documentCode: string;
  title: string;
  category: GovSecureCategory;
}

export interface RegulationExplainerResponse {
  source: 'curated' | 'generated';
  regulation: string;
  article: string;
  title: string;
  slug: string;
  body: string;
  officialUrl?: string;
  relatedDocs: RelatedDoc[];
  nistMappings: string[];
  generatedAt: string;
}

const explainerCache = new ResponseCache<RegulationExplainerResponse>({
  maxSize: 300,
  ttlMs: 24 * 60 * 60 * 1000,
});

function buildRelatedDocs(codes: string[] = []): RelatedDoc[] {
  const out: RelatedDoc[] = [];
  for (const code of codes) {
    const doc = getDocumentByCode(code);
    if (!doc) continue;
    out.push({ documentCode: code, title: doc.title, category: doc.category });
  }
  return out;
}

function entryToResponse(
  entry: RegulationEntry,
  fullSlug: string,
): RegulationExplainerResponse {
  return {
    source: 'curated',
    regulation: entry.regulation,
    article: entry.article,
    title: entry.title,
    slug: fullSlug,
    body: entry.body,
    officialUrl: entry.officialUrl,
    relatedDocs: buildRelatedDocs(entry.relatedGovSecureCodes),
    nistMappings: entry.nistMappings ?? [],
    generatedAt: new Date().toISOString(),
  };
}

function buildLlmPrompt(regulation: string, article: string, query?: string): string {
  return [
    `Produce a long-form explainer for the regulatory provision below, written for an AI-product team that needs to act on it. ${query ? `The user originally asked: "${query}". Tailor the explainer to that context where relevant.` : ''}`,
    '',
    `Regulation: ${regulation}`,
    `Article / Section: ${article}`,
    '',
    'Use this exact structure (markdown):',
    '',
    '**Plain-language summary**',
    '',
    '2–4 sentences describing what the provision does and why it exists.',
    '',
    '**What it requires (for AI systems)**',
    '',
    'A bulleted list of concrete obligations, focused on AI-specific implications.',
    '',
    '**Practical implications**',
    '',
    '2–4 sentences of operational guidance — common failure modes, what auditors look for, how it interacts with neighbouring regulations.',
    '',
    'Rules:',
    '- Write in our own words. Do not reproduce regulatory text verbatim.',
    '- If you do not know the precise wording of the provision, say so explicitly rather than inventing.',
    '- Keep total length under 350 words.',
    '- Do not invent article numbers, case names, or fine amounts.',
  ].join('\n');
}

async function generateExplainer(
  regulation: string,
  article: string,
  query?: string,
): Promise<string> {
  const prompt = buildLlmPrompt(regulation, article, query);
  const model = 'gpt-4o-mini';

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openaiCircuit.execute(() =>
      client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior AI governance counsel writing concise, accurate explainers for technical teams. Be precise; do not invent.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
    );
    const body = completion.choices[0]?.message?.content?.trim();
    if (!body) throw new Error('Empty LLM response');
    return body;
  } catch (err) {
    if (isOpenAIQuotaError(err) && isClaudeFallbackAvailable()) {
      const claude = await claudeComplete({
        system:
          'You are a senior AI governance counsel writing concise, accurate explainers for technical teams. Be precise; do not invent.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 700,
        temperature: 0.2,
      });
      return claude.content.trim();
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const role = session.user.role ?? 'FREE';
  if (!PAID_ROLES.has(role)) {
    return NextResponse.json(
      { error: 'Regulation explainers are available on Pro and above.', upgrade: '/pricing' },
      { status: 403 },
    );
  }

  const rateCheck = await checkRateLimit(session.user.id, '/api/regulations/explain', role);
  const headers = buildRateLimitHeaders(rateCheck);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers },
    );
  }

  let body: z.infer<typeof explainRequestSchema>;
  try {
    body = explainRequestSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request', details: err instanceof z.ZodError ? err.flatten() : undefined },
      { status: 400 },
    );
  }

  const { regulation, article, query } = body;
  const { fullSlug } = toSlugs(regulation, article);

  // 1. Curated path
  const curated = getRegulationEntry(regulation, article);
  if (curated) {
    auditLog({
      event: 'regulation.explain.served',
      data: { slug: fullSlug, source: 'curated', userId: session.user.id },
    });
    return NextResponse.json(entryToResponse(curated, fullSlug), { headers });
  }

  // 2. LLM fallback (cached)
  const cacheKey = ResponseCache.buildKey(fullSlug, query, undefined, 'explainer');
  const cached = explainerCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers });
  }

  try {
    const generatedBody = await generateExplainer(regulation, article, query);
    const response: RegulationExplainerResponse = {
      source: 'generated',
      regulation,
      article,
      title: `${regulation} — ${article}`,
      slug: fullSlug,
      body: generatedBody,
      relatedDocs: [],
      nistMappings: [],
      generatedAt: new Date().toISOString(),
    };
    explainerCache.set(cacheKey, response);
    auditLog({
      event: 'regulation.explain.served',
      data: { slug: fullSlug, source: 'generated', userId: session.user.id },
    });
    return NextResponse.json(response, { headers });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again shortly.' },
        { status: 503, headers },
      );
    }
    auditLog({
      event: 'regulation.explain.error',
      data: { slug: fullSlug, message: err instanceof Error ? err.message : 'unknown' },
    });
    return NextResponse.json(
      { error: 'Failed to generate explainer. Please try again.' },
      { status: 500, headers },
    );
  }
}
