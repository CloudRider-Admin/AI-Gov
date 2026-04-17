/**
 * Prompt Injection Protection
 *
 * Detects and sanitizes potential prompt injection attacks before
 * user input reaches the LLM. Uses a layered approach:
 *   1. Pattern-based detection (known injection signatures)
 *   2. Heuristic scoring (structural anomalies)
 *   3. Input sanitization (strip control characters, normalize)
 */

import { auditLog } from '@/lib/utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InjectionCheckResult {
  safe: boolean;
  score: number;          // 0.0 (safe) to 1.0 (definite injection)
  triggers: string[];     // which patterns/heuristics matched
  sanitized: string;      // cleaned version of the input
}

// ─── Known Injection Patterns ────────────────────────────────────────────────

const INJECTION_PATTERNS: { pattern: RegExp; label: string; weight: number }[] = [
  // Direct instruction overrides
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i, label: 'instruction_override', weight: 0.9 },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)/i, label: 'disregard_override', weight: 0.9 },
  { pattern: /forget\s+(everything|all|what)\s+(you|i)\s+(told|said|know)/i, label: 'memory_wipe', weight: 0.85 },

  // Role/identity manipulation
  { pattern: /you\s+are\s+now\s+(a|an|the)\s+/i, label: 'role_reassignment', weight: 0.8 },
  { pattern: /act\s+as\s+(if\s+you\s+are\s+|a\s+|an\s+)/i, label: 'role_play_injection', weight: 0.6 },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+/i, label: 'pretend_injection', weight: 0.7 },
  { pattern: /switch\s+to\s+(developer|admin|root|sudo|god)\s+mode/i, label: 'mode_switch', weight: 0.95 },

  // System prompt extraction
  { pattern: /(?:what|show|reveal|repeat|print|output|display)\s+(?:is\s+)?(?:your|the)\s+(?:system\s+)?prompt/i, label: 'prompt_extraction', weight: 0.85 },
  { pattern: /(?:show|reveal|print|output|display)\s+(?:your|the)\s+(?:initial|original|hidden)\s+(instructions?|rules?|context)/i, label: 'instruction_extraction', weight: 0.85 },

  // Encoding/obfuscation attacks
  { pattern: /base64[:\s]+[A-Za-z0-9+/]{20,}={0,2}/i, label: 'base64_payload', weight: 0.7 },
  { pattern: /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){3,}/i, label: 'hex_encoding', weight: 0.7 },

  // Delimiter/separator injection
  { pattern: /---+\s*(?:system|assistant|user)\s*---+/i, label: 'role_delimiter', weight: 0.9 },
  { pattern: /\[SYSTEM\]|\[INST\]|<<SYS>>|<\|im_start\|>/i, label: 'template_injection', weight: 0.95 },
  { pattern: /<\/?(?:system|assistant|user|instruction)>/i, label: 'xml_role_tag', weight: 0.85 },

  // Jailbreak patterns
  { pattern: /(?:DAN|do\s+anything\s+now)\s+(?:mode|prompt|jailbreak)/i, label: 'dan_jailbreak', weight: 0.95 },
  { pattern: /(?:bypass|circumvent|disable|override)\s+(?:your|the|all)\s+(?:safety|content|ethical|security)\s+(?:filters?|guidelines?|restrictions?|rules?)/i, label: 'safety_bypass', weight: 0.9 },

  // Multi-step / indirect
  { pattern: /(?:first|step\s*1)[:\s]+(?:ignore|forget|disregard)/i, label: 'multi_step_injection', weight: 0.8 },
  { pattern: /translate\s+(?:this|the\s+following)\s+(?:to|into)\s+(?:a\s+)?(?:format|language)\s+(?:that|where)/i, label: 'translation_bypass', weight: 0.5 },
];

// ─── Heuristic Checks ───────────────────────────────────────────────────────

function heuristicScore(text: string): { score: number; triggers: string[] } {
  const triggers: string[] = [];
  let score = 0;

  // Excessive special characters (potential obfuscation)
  const specialRatio = (text.match(/[{}[\]<>|\\`~^]/g)?.length ?? 0) / Math.max(text.length, 1);
  if (specialRatio > 0.15) {
    score += 0.3;
    triggers.push('high_special_char_ratio');
  }

  // Very long input (may contain hidden instructions)
  if (text.length > 5000) {
    score += 0.15;
    triggers.push('excessive_length');
  }

  // Multiple newlines suggesting structured injection
  const newlineCount = (text.match(/\n/g)?.length ?? 0);
  if (newlineCount > 20) {
    score += 0.2;
    triggers.push('excessive_newlines');
  }

  // Mixed-case word boundaries that suggest obfuscation (e.g., "iGnOrE")
  const words = text.split(/\s+/);
  const mixedCaseCount = words.filter(w => {
    if (w.length < 4) return false;
    const uppers = (w.match(/[A-Z]/g)?.length ?? 0);
    const lowers = (w.match(/[a-z]/g)?.length ?? 0);
    return uppers > 0 && lowers > 0 && uppers > 1 && uppers / w.length > 0.3 && uppers / w.length < 0.7;
  }).length;
  if (mixedCaseCount > 3) {
    score += 0.25;
    triggers.push('mixed_case_obfuscation');
  }

  // Repeated separator characters (potential delimiter injection)
  if (/[-=_]{10,}/.test(text)) {
    score += 0.3;
    triggers.push('separator_injection');
  }

  return { score: Math.min(score, 1), triggers };
}

// ─── Sanitization ────────────────────────────────────────────────────────────

/**
 * Remove control characters and normalize whitespace without destroying
 * legitimate content. Preserves standard punctuation and newlines.
 */
export function sanitizeInput(text: string): string {
  return text
    // Strip null bytes and other C0 control chars (except \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize Unicode direction overrides (used for visual spoofing)
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    // Collapse multiple spaces
    .replace(/ {3,}/g, '  ')
    // Collapse excessive newlines (more than 3 → 2)
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ─── Main Detection ──────────────────────────────────────────────────────────

const BLOCK_THRESHOLD = 0.7;
const WARN_THRESHOLD = 0.4;

/**
 * Analyze user input for potential prompt injection attacks.
 *
 * @returns InjectionCheckResult with safety assessment, score, and sanitized text
 */
export function detectInjection(text: string): InjectionCheckResult {
  const sanitized = sanitizeInput(text);
  const triggers: string[] = [];
  let maxPatternWeight = 0;

  // Pattern matching
  for (const { pattern, label, weight } of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      triggers.push(label);
      maxPatternWeight = Math.max(maxPatternWeight, weight);
    }
  }

  // Heuristic scoring
  const heuristics = heuristicScore(sanitized);
  triggers.push(...heuristics.triggers);

  // Combined score: max of pattern weight and heuristic score (patterns dominate)
  const combinedScore = Math.min(
    maxPatternWeight + heuristics.score * 0.3, // patterns + weighted heuristics
    1.0,
  );

  const score = Math.round(combinedScore * 100) / 100;
  const safe = score < BLOCK_THRESHOLD;

  return { safe, score, triggers, sanitized };
}

/**
 * Full guard: detect injection, log if suspicious, return sanitized input or throw.
 *
 * @param input  Raw user text
 * @param meta   Additional context for audit logging
 * @returns sanitized input string
 * @throws Error if injection score exceeds block threshold
 */
export function guardInput(
  input: string,
  meta?: { userId?: string; endpoint?: string },
): string {
  const result = detectInjection(input);

  if (result.score >= WARN_THRESHOLD) {
    auditLog({
      event: 'security.injection_detected',
      data: {
        score: result.score,
        triggers: result.triggers,
        blocked: !result.safe,
        inputLength: input.length,
        ...meta,
      },
    });
  }

  if (!result.safe) {
    throw new PromptInjectionError(
      'Your message was flagged by our security system. Please rephrase your question about AI governance.',
      result.score,
      result.triggers,
    );
  }

  return result.sanitized;
}

// ─── Custom Error ────────────────────────────────────────────────────────────

export class PromptInjectionError extends Error {
  public readonly score: number;
  public readonly triggers: string[];

  constructor(message: string, score: number, triggers: string[]) {
    super(message);
    this.name = 'PromptInjectionError';
    this.score = score;
    this.triggers = triggers;
  }
}
