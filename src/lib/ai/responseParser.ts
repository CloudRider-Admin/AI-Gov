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
 * Parse raw OpenAI response text into a partial AdvisorResponse.
 * Handles json_object format (primary) and falls back to regex extraction.
 */
export function parseAdvisorResponse(raw: string): Partial<AdvisorResponse> {
  // Primary path: response_format: json_object should give clean JSON
  try {
    return JSON.parse(raw.trim());
  } catch {
    // Fallback: try to extract JSON from markdown code blocks
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Last resort: regex match
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch { /* fall through */ }
      }
    }
  }

  // Complete failure — return minimal structure
  return {
    riskProfile: {
      level: 'medium',
      description: raw.substring(0, 500),
      confidence: 0.5,
      reasoning: ['Response received but could not parse structured data'],
    },
    suggestedPolicies: [],
    regulationCheck: [],
    followUpQuestions: [],
    sources: [],
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
