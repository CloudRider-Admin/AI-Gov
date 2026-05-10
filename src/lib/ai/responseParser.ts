/**
 * Parses and validates OpenAI responses for the advisor endpoint.
 *
 * Extracted from the advisor route to enable reuse and independent testing.
 */

import {
  advisorResponseSchema,
  buildFallbackResponse,
  type AdvisorResponse,
} from './schemas';
import type { EnhancedRAGResult } from './rag';

/**
 * Repair a truncated or lightly-malformed JSON string.
 *
 * Common failure modes from LLMs we patch here:
 *   - Truncation at max_tokens leaves unclosed `{`, `[`, or `"`.
 *   - Trailing comma before `}` / `]`.
 *   - A stray comma at the very end of the document.
 *
 * The repair is intentionally conservative: it walks the string once,
 * tracks string/escape state so braces inside string literals don't
 * unbalance the stack, and only appends what's needed to terminate
 * cleanly. If repair still doesn't yield parseable JSON, the caller
 * falls back to clarification mode.
 */
function repairJson(input: string): string {
  // Pass 1: walk the string tracking string/escape state. Collect indices of
  // commas that should be stripped (those immediately followed — after
  // whitespace — by `}` or `]`, or by end-of-input). Track open brackets so
  // we can close them.
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  const stripCommaAt = new Set<number>();
  let lastCommaIdx = -1;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { if (inString) escape = true; continue; }
    if (ch === '"') { inString = !inString; lastCommaIdx = -1; continue; }
    if (inString) continue;
    if (/\s/.test(ch)) continue;

    if (ch === ',') { lastCommaIdx = i; continue; }
    if (ch === '}' || ch === ']') {
      if (lastCommaIdx >= 0) stripCommaAt.add(lastCommaIdx);
      if (ch === '}' && stack[stack.length - 1] === '{') stack.pop();
      else if (ch === ']' && stack[stack.length - 1] === '[') stack.pop();
      lastCommaIdx = -1;
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch);
    lastCommaIdx = -1;
  }
  // Comma still hanging at EOF (truncated array/object).
  if (lastCommaIdx >= 0) stripCommaAt.add(lastCommaIdx);

  // Pass 2: rebuild the string skipping stripped commas.
  let repaired = '';
  for (let i = 0; i < input.length; i++) {
    if (!stripCommaAt.has(i)) repaired += input[i];
  }

  // Close an unterminated string literal so the appended brackets land
  // outside the string.
  if (inString) repaired += '"';
  // Close still-open containers in reverse order.
  while (stack.length > 0) {
    const open = stack.pop();
    repaired += open === '{' ? '}' : ']';
  }
  return repaired;
}

/** Extract the outermost JSON object from text, stripping prose and code fences. */
function extractJsonCandidate(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  if (start !== -1) return raw.slice(start);
  return raw.trim();
}

/**
 * Parse raw LLM response text into a partial AdvisorResponse.
 *
 * Strategy, in order:
 *   1. Direct JSON.parse on the trimmed input (the happy path under
 *      OpenAI's `response_format: json_object`).
 *   2. Strip code fences / surrounding prose, parse that.
 *   3. Repair common truncation/trailing-comma damage and parse.
 *   4. Last-ditch: extract candidate then repair then parse.
 *
 * If every path fails, return a clarification-mode shape rather than a
 * fake risk score — the broken "Medium · 50%" card was misleading users
 * into thinking the model had assessed their query.
 */
export function parseAdvisorResponse(raw: string): Partial<AdvisorResponse> {
  const trimmed = raw.trim();

  try { return JSON.parse(trimmed); } catch { /* try next */ }

  const candidate = extractJsonCandidate(trimmed);
  try { return JSON.parse(candidate); } catch { /* try next */ }

  try { return JSON.parse(repairJson(candidate)); } catch { /* try next */ }

  try { return JSON.parse(repairJson(trimmed)); } catch { /* fall through */ }

  // Total parse failure → render as clarification so the UI shows the
  // questionnaire instead of a misleading risk card.
  return {
    mode: 'clarification',
    riskProfile: {
      level: 'medium',
      description:
        "I didn't quite catch the specifics — could you tell me a bit more about the AI system or use case you'd like me to assess?",
      confidence: 0.3,
      reasoning: [],
    },
    suggestedPolicies: [],
    regulationCheck: [],
    followUpQuestions: [
      'What AI system or tool are you assessing (e.g. chatbot, ML model, vendor product)?',
      'What industry or sector is this deployed in?',
      'What kind of data does it process (personal, financial, health, public)?',
      'Who are the end users and what decisions does the system inform?',
      'What is the deployment context — internal pilot, customer-facing, regulated workflow?',
    ],
    sources: [],
    intent: { type: 'advisor' },
  };
}

/**
 * Normalize GPT output to match Zod schema expectations.
 *
 * GPT-4o frequently deviates from the requested schema:
 *   - Capitalized enums ("Medium" vs "medium")
 *   - Renamed fields (confidenceScore vs confidence, policy vs title)
 *   - Missing required fields (description, reasoning, article, category)
 *   - Intent as a string instead of an object
 *
 * This function patches all known deviations so Zod validation passes.
 */
function normalizeGptResponse(raw: Record<string, unknown>): Record<string, unknown> {
  const data = { ...raw };

  // ── Normalize riskProfile ──
  if (data.riskProfile && typeof data.riskProfile === 'object') {
    const rp = { ...(data.riskProfile as Record<string, unknown>) };

    // level: "Medium" → "medium"
    if (typeof rp.level === 'string') {
      rp.level = rp.level.toLowerCase();
    }
    if (!rp.level || !['low', 'medium', 'high', 'critical'].includes(rp.level as string)) {
      rp.level = 'medium';
    }

    // confidence: GPT may use "confidenceScore" instead of "confidence"
    if (rp.confidence == null && rp.confidenceScore != null) {
      rp.confidence = rp.confidenceScore;
      delete rp.confidenceScore;
    }

    // confidence: string → number (e.g. "High" → 0.85, "0.75" → 0.75)
    if (typeof rp.confidence === 'string') {
      const parsed = parseFloat(rp.confidence);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        rp.confidence = parsed;
      } else {
        const textMap: Record<string, number> = { high: 0.85, medium: 0.6, low: 0.35 };
        rp.confidence = textMap[rp.confidence.toLowerCase()] ?? 0.6;
      }
    }
    if (typeof rp.confidence !== 'number' || isNaN(rp.confidence as number)) {
      rp.confidence = 0.6;
    }

    // description: GPT sometimes omits it or uses alternate field names
    if (!rp.description || typeof rp.description !== 'string') {
      // Try alternate fields GPT might use
      const alt = (rp.summary ?? rp.assessment ?? rp.analysis ?? rp.overview) as string | undefined;
      if (alt && typeof alt === 'string') {
        rp.description = alt;
      } else if (Array.isArray(rp.reasoning) && rp.reasoning.length > 0) {
        rp.description = (rp.reasoning as string[]).join(' ');
      } else {
        // Build from top-level fields GPT may have added
        const topLevel = data as Record<string, unknown>;
        const topSummary = (topLevel.summary ?? topLevel.analysis ?? topLevel.assessment) as string | undefined;
        if (topSummary && typeof topSummary === 'string') {
          rp.description = topSummary;
        } else {
          rp.description = `${(rp.level as string).charAt(0).toUpperCase() + (rp.level as string).slice(1)} risk identified for this AI use case.`;
        }
      }
    }

    // reasoning: ensure array; GPT may omit or return a string
    if (!Array.isArray(rp.reasoning)) {
      rp.reasoning = typeof rp.reasoning === 'string' ? [rp.reasoning] : [];
    }

    data.riskProfile = rp;
  }

  // ── Normalize suggestedPolicies ──
  if (Array.isArray(data.suggestedPolicies)) {
    data.suggestedPolicies = (data.suggestedPolicies as Record<string, unknown>[]).map(p => {
      const policy = { ...p };
      // GPT uses "policy" or "name" instead of "title"
      if (!policy.title && policy.policy) {
        policy.title = policy.policy;
        delete policy.policy;
      }
      if (!policy.title && policy.name) {
        policy.title = policy.name;
        delete policy.name;
      }
      if (!policy.title) policy.title = 'Policy recommendation';
      if (!policy.description) policy.description = '';
      // priority: lowercase
      if (typeof policy.priority === 'string') {
        policy.priority = policy.priority.toLowerCase();
      }
      if (!policy.priority || !['high', 'medium', 'low'].includes(policy.priority as string)) {
        policy.priority = 'medium';
      }
      // category: GPT often omits
      if (!policy.category) policy.category = 'governance';
      return policy;
    });
  }

  // ── Normalize regulationCheck ──
  if (Array.isArray(data.regulationCheck)) {
    data.regulationCheck = (data.regulationCheck as Record<string, unknown>[]).map(r => {
      const reg = { ...r };
      if (!reg.regulation) reg.regulation = 'General';
      if (!reg.description) reg.description = '';
      // article: GPT frequently omits; fill from regulation name
      if (!reg.article || typeof reg.article !== 'string') {
        reg.article = `See ${reg.regulation as string}`;
      }
      // relevance: lowercase
      if (typeof reg.relevance === 'string') {
        reg.relevance = reg.relevance.toLowerCase();
      }
      if (!reg.relevance || !['high', 'medium', 'low'].includes(reg.relevance as string)) {
        reg.relevance = 'medium';
      }
      return reg;
    });
  }

  // ── Normalize mode ──
  if (typeof data.mode === 'string') {
    data.mode = data.mode.toLowerCase();
  }
  if (!data.mode || !['assessment', 'clarification'].includes(data.mode as string)) {
    data.mode = 'assessment';
  }

  // ── In clarification mode, force intent to advisor and clear policies/regulations ──
  if (data.mode === 'clarification') {
    data.suggestedPolicies = [];
    data.regulationCheck = [];
    data.intent = { type: 'advisor' };
  }

  // ── Normalize intent: string → object, or fix casing ──
  if (typeof data.intent === 'string' || data.intent == null) {
    data.intent = { type: 'advisor' };
  } else if (typeof data.intent === 'object') {
    const intent = { ...(data.intent as Record<string, unknown>) };
    if (typeof intent.type === 'string') {
      intent.type = intent.type.toLowerCase();
    }
    if (!intent.type || !['advisor', 'intake', 'document', 'playbook'].includes(intent.type as string)) {
      intent.type = 'advisor';
    }
    data.intent = intent;
  }

  return data;
}

/**
 * Build a validated AdvisorResponse from a parsed partial response.
 * Fills in defaults, merges RAG sources, and validates via Zod.
 */
export function buildValidatedResponse(
  parsed: Partial<AdvisorResponse>,
  conversationId: string,
  ragResult: EnhancedRAGResult,
): { success: true; data: AdvisorResponse } | { success: false; fallback: AdvisorResponse } {
  const normalized = normalizeGptResponse(parsed as Record<string, unknown>);

  const candidate = {
    mode: (normalized.mode as string) || 'assessment',
    riskProfile: normalized.riskProfile || {
      level: 'medium' as const,
      description: 'Unable to assess risk profile',
      confidence: 0.5,
      reasoning: ['Insufficient information provided'],
    },
    suggestedPolicies: normalized.suggestedPolicies || [],
    regulationCheck: normalized.regulationCheck || [],
    followUpQuestions: normalized.followUpQuestions || [],
    sources: [
      ...((normalized.sources as string[]) || ['AI Governance Analysis']),
      ...ragResult.sources,
    ],
    // Mirror RAG-supplied structured provenance through to the response.
    // LLM-supplied sources only land in the flat list; they don't carry a
    // typed bucket so they're intentionally excluded here.
    sourcesStructured: ragResult.sourcesStructured,
    conversationId,
    timestamp: new Date().toISOString(),
    ...(normalized.intent && typeof normalized.intent === 'object' ? { intent: normalized.intent } : {}),
  };

  const result = advisorResponseSchema.safeParse(candidate);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, fallback: buildFallbackResponse('Response validation failed', conversationId) };
}

/**
 * Apply tier-based gating to an advisor response.
 * Free/Guest users see only 1 policy recommendation and no regulations.
 */
export function applyGating(
  response: AdvisorResponse,
  role: string,
  generatedArtifact?: AdvisorResponse['generatedArtifact'],
): AdvisorResponse {
  const isGated = role === 'GUEST' || role === 'FREE';

  if (isGated) {
    return {
      ...response,
      suggestedPolicies: response.suggestedPolicies.slice(0, 1),
      regulationCheck: [],
      gated: true,
    };
  }

  return {
    ...response,
    ...(generatedArtifact ? { generatedArtifact } : {}),
  };
}