/**
 * Deterministic intent classifier for advisor queries.
 *
 * Runs BEFORE the LLM call to pre-classify user intent with high accuracy.
 * The LLM can override the classification, but if both agree the dispatch
 * is high-confidence. If they disagree, the system returns a follow-up
 * question to clarify.
 */

export type IntentType = 'advisor' | 'intake' | 'document' | 'playbook';

export interface ClassifiedIntent {
  type: IntentType;
  confidence: 'high' | 'medium' | 'low';
  documentType?: string;
  framework?: string;
  extractedDescription?: string;
  /** True when the query intends generation but lacks specifics (no use case, industry, etc.) */
  needsClarification?: boolean;
}

/**
 * Document-type detection patterns. Order matters — Object.entries() preserves
 * insertion order, and `detectDocumentType` returns the first match. The
 * GovSecure-prefixed types come first so prompts that explicitly say
 * "GovSecure AUP" or "AI Acceptable Use Policy" don't fall through to the
 * generic `dpia`/`threat-model` patterns.
 */
const DOCUMENT_TYPE_PATTERNS: Record<string, RegExp> = {
  // ── GovSecure policies (Phase 2.5) ──
  'govsecure-aup': /\b(?:acceptable\s+use\s+policy|\baup\b|govsecure\s+aup)\b/i,
  'govsecure-governance-policy': /\b(?:ai\s+governance\s+policy|govsecure\s+governance)\b/i,
  'govsecure-data-privacy-policy': /\b(?:ai\s+data\s+privacy\s+policy|govsecure\s+(?:data\s+)?privacy\s+policy)\b/i,
  'govsecure-risk-approval-policy': /\b(?:ai\s+risk\s+(?:and|&)\s+approval\s+policy|risk\s+approval\s+policy)\b/i,
  'govsecure-security-policy': /\b(?:ai\s+security\s+policy|govsecure\s+security\s+policy)\b/i,
  'govsecure-incident-response-policy': /\b(?:ai\s+incident\s+response\s+policy)\b/i,
  'govsecure-human-oversight-policy': /\b(?:ai\s+human\s+oversight\s+policy)\b/i,
  'govsecure-vendor-policy': /\b(?:ai\s+(?:vendor|third[-\s]?party)\s+policy|vendor\s+(?:management|governance)\s+policy)\b/i,
  // ── GovSecure checklists (Phase 2.5) ──
  'govsecure-checklist-intake': /\b(?:ai\s+(?:use\s+case\s+)?intake\s+(?:form\s+)?checklist|intake\s+checklist)\b/i,
  'govsecure-checklist-evidence-pack': /\b(?:evidence\s+pack\s+checklist)\b/i,
  'govsecure-checklist-incident-response': /\b(?:ai\s+incident\s+response\s+checklist|incident\s+response\s+checklist)\b/i,
  'govsecure-checklist-vendor-dd': /\b(?:vendor\s+due\s+diligence\s+checklist|third[-\s]?party\s+(?:dd|due\s+diligence)\s+checklist)\b/i,
  'govsecure-checklist-shadow-ai': /\b(?:shadow\s+ai\s+(?:discovery\s+)?checklist|shadow\s+ai)\b/i,
  'govsecure-checklist-inventory': /\b(?:ai\s+(?:inventory|registry)\s+checklist|system\s+registry\s+checklist)\b/i,
  'govsecure-checklist-model-validation': /\b(?:model\s+validation\s+(?:and|&)?\s*testing\s+checklist|model\s+validation\s+checklist)\b/i,
  'govsecure-checklist-monitoring': /\b(?:monitoring\s+(?:and|&)?\s*revalidation\s+checklist|ai\s+monitoring\s+checklist)\b/i,
  'govsecure-checklist-security': /\b(?:ai\s+security\s+review\s+checklist|security\s+review\s+checklist)\b/i,
  'govsecure-checklist-dpia': /\b(?:dpia\s+screening\s+checklist|privacy\s+screening\s+checklist)\b/i,
  'govsecure-checklist-human-oversight': /\b(?:human\s+oversight\s+(?:and|&)?\s*escalation\s+checklist|oversight\s+escalation\s+checklist)\b/i,
  'govsecure-checklist-change-management': /\b(?:ai\s+change\s+management\s+checklist|change\s+management\s+checklist)\b/i,
  'govsecure-checklist-training': /\b(?:training\s+(?:and|&)?\s*(?:role[-\s]?based\s+)?awareness\s+checklist)\b/i,
  'govsecure-checklist-risk-assessment': /\b(?:ai\s+risk\s+assessment\s+(?:template\s+)?checklist|risk\s+assessment\s+checklist)\b/i,
  // ── GovSecure flagship questionnaires + framework templates (Phase 3) ──
  'govsecure-tprm': /\b(?:tprm(?:\s+questionnaire)?|third[-\s]?party\s+risk\s+management\s+(?:questionnaire|assessment)|vendor\s+risk\s+questionnaire)\b/i,
  'govsecure-nist-rcm': /\b(?:nist\s+rcm|risk\s+control\s+matrix|nist\s+ai\s+rmf\s+matrix)\b/i,
  // ── Generic governance documents (predate GovSecure integration) ──
  'dpia': /\b(?:dpia|data\s+protection\s+impact|privacy\s+impact)\b/i,
  'threat-model': /\b(?:threat\s+model|security\s+assessment|attack\s+surface)\b/i,
  'model-card': /\b(?:model\s+card|model\s+documentation|model\s+spec)\b/i,
  'data-sheet': /\b(?:data\s+sheet|data\s+governance\s+doc|data\s+inventory)\b/i,
  'human-oversight-statement': /\b(?:human\s+oversight|oversight\s+statement|human-in-the-loop\s+doc)\b/i,
  'risk-memo': /\b(?:risk\s+memo|risk\s+assessment\s+memo|risk\s+report)\b/i,
  'use-case-summary': /\b(?:use\s+case\s+summary|use\s+case\s+doc)\b/i,
  'vendor-model-facts': /\b(?:vendor\s+(?:fact|assessment|review)|model\s+facts?\s+sheet)\b/i,
  'operational-readiness-plan': /\b(?:operational\s+readiness|go-live\s+plan|deployment\s+plan)\b/i,
  'monitoring-plan': /\b(?:monitoring\s+plan|audit\s+plan|observability\s+plan)\b/i,
  'evidence-pack': /\b(?:evidence\s+pack|compliance\s+evidence|audit\s+pack)\b/i,
};

/**
 * Framework detection patterns. Order matters — `Object.entries` preserves
 * insertion order and the first match wins. GovSecure-flagship patterns come
 * before the generic regulatory ones so prompts that mention "AI Chef" or
 * "90-day blueprint" route to the right framework even if NIST is also
 * mentioned.
 */
const FRAMEWORK_PATTERNS: Record<string, RegExp> = {
  'GovSecure AI Chef': /\b(?:ai\s+chef|chef\s+(?:playbook|operating\s+model|toolkit|stations?))\b/i,
  'GovSecure 90-Day Blueprint': /\b(?:90.?day\s+(?:blueprint|plan|roadmap|implementation))\b/i,
  'NIST AI RMF': /\b(?:nist|ai\s+rmf|risk\s+management\s+framework)\b/i,
  'EU AI Act': /\b(?:eu\s+ai\s+act|european\s+ai|ai\s+act)\b/i,
  'ISO/IEC 42001': /\b(?:iso\s*(?:\/iec)?\s*42001|aims|ai\s+management\s+system)\b/i,
  'Combined': /\b(?:combined|all\s+frameworks|comprehensive\s+compliance)\b/i,
};

/** Patterns that strongly indicate document generation intent */
const GENERATE_DOCUMENT_PATTERN = /\b(?:generate|create|write|produce|draft|build)\b.*\b(?:dpia|threat\s+model|model\s+card|data\s+sheet|human\s+oversight|risk\s+memo|use\s+case\s+summary|vendor|operational\s+readiness|monitoring\s+plan|evidence\s+pack|document|report|policy|checklist|aup|shadow\s+ai)\b/i;

/** Patterns that strongly indicate intake/risk assessment intent */
const INTAKE_PATTERN = /\b(?:assess|evaluate|intake|risk\s+assessment|analyze\s+(?:the\s+)?risk|score\s+(?:the\s+)?risk|run\s+(?:an?\s+)?(?:intake|assessment))\b/i;

/** Patterns that strongly indicate playbook/implementation plan intent */
const PLAYBOOK_PATTERN = /\b(?:playbook|roadmap|implementation\s+plan|compliance\s+plan|governance\s+plan|action\s+plan|step-by-step\s+plan|ai\s+chef|90.?day\s+(?:blueprint|plan))\b/i;

/** Patterns that indicate generation — used to distinguish "generate X" from "what is X" */
const GENERATION_VERBS = /\b(?:generate|create|write|produce|draft|build|make|prepare|need)\b/i;

/** Patterns that indicate a question, not a generation request */
const QUESTION_PATTERN = /\b(?:what\s+(?:is|are|does|should)|how\s+(?:do|does|should|can)|explain|tell\s+me|describe|what's|should\s+(?:we|i|you))\b/i;

/**
 * Patterns that indicate the user has provided a SPECIFIC use case or context.
 * If none of these match, the query is considered too vague for direct generation.
 */
const SPECIFIC_CONTEXT_PATTERNS = [
  // Mentions a specific AI system or tool type
  /\b(?:chatbot|recommendation\s+(?:engine|system)|fraud\s+detection|credit\s+scor|hiring\s+(?:ai|tool|system)|resume\s+screen|facial\s+recogni|sentiment\s+analy|predictive\s+(?:model|analyt)|classification\s+(?:model|system)|language\s+model|image\s+(?:generat|recogni)|speech\s+(?:recogni|to\s+text)|autonomous|self-driving|medical\s+(?:diagnos|imaging)|loan\s+(?:approv|underwrit)|insurance\s+(?:claim|pricing)|content\s+(?:moderat|filter))\b/i,
  // Mentions a specific industry / sector
  /\b(?:healthcare|financial|banking|insurance|education|government|legal|manufacturing|retail|e-commerce|transportation|energy|telecom|pharmaceutical|real\s+estate|agriculture|logistics|defense|media|entertainment|hospitality|automotive)\b/i,
  // Mentions specific data types being processed
  /\b(?:personal\s+data|biometric|health\s+(?:data|records)|financial\s+(?:data|records)|employee\s+(?:data|records)|customer\s+(?:data|records|info)|PII|PHI|sensitive\s+data|children|minors)\b/i,
  // Mentions a specific company, product, or project name (proper nouns — 2+ capitalized words)
  /(?:[A-Z][a-z]+\s+){1,}(?:AI|ML|Bot|System|Platform|Tool|App)/,
  // Mentions deployment context
  /\b(?:deploy(?:ing|ed|ment)?|launch(?:ing|ed)?|production|live|customer-facing|internal(?:ly)?|public-facing)\b/i,
  // Has enough length and detail (50+ chars after stripping generation verbs)
  // This is checked programmatically below
];

/**
 * Returns true if the query contains enough context for Govi to generate
 * a meaningful assessment or artifact without asking for more info.
 */
function hasSpecificContext(query: string): boolean {
  // Check each pattern — any match means we have some specifics
  let matchCount = 0;
  for (const pattern of SPECIFIC_CONTEXT_PATTERNS) {
    if (pattern.test(query)) matchCount++;
  }
  // If 2+ patterns match, definitely has context
  if (matchCount >= 2) return true;

  // Check if the extracted description (after stripping verbs/doc types) has substance
  const stripped = extractDescription(query);
  if (matchCount >= 1 && stripped.length > 30) return true;

  // Long, detailed queries (100+ chars) with at least one context signal
  if (query.length > 100 && matchCount >= 1) return true;

  return false;
}

/**
 * Classify user intent using deterministic pattern matching.
 *
 * This runs in <1ms and catches ~95% of explicit generation requests.
 * For ambiguous queries, it falls back to 'advisor' with low confidence,
 * signaling the LLM should make the final call.
 *
 * When a generation intent is detected but the query lacks specifics,
 * `needsClarification` is set to true so the system asks follow-up questions
 * instead of generating a generic artifact.
 */
export function classifyIntent(query: string, hasExistingThread = false): ClassifiedIntent {
  const trimmed = query.trim();

  // Check if this is a question about something (not a generation request)
  const isQuestion = QUESTION_PATTERN.test(trimmed) && !GENERATION_VERBS.test(trimmed);

  // 1. Check for explicit document generation
  if (GENERATE_DOCUMENT_PATTERN.test(trimmed) && !isQuestion) {
    const documentType = detectDocumentType(trimmed);
    if (documentType) {
      const needsClarification = !hasExistingThread && !hasSpecificContext(trimmed);
      return {
        type: 'document',
        confidence: 'high',
        documentType,
        extractedDescription: extractDescription(trimmed),
        needsClarification,
      };
    }
  }

  // 2. Check for intake/risk assessment
  if (INTAKE_PATTERN.test(trimmed) && !isQuestion) {
    const needsClarification = !hasExistingThread && !hasSpecificContext(trimmed);
    return {
      type: 'intake',
      confidence: 'high',
      extractedDescription: extractDescription(trimmed),
      needsClarification,
    };
  }

  // 3. Check for playbook/implementation plan generation
  if (PLAYBOOK_PATTERN.test(trimmed) && GENERATION_VERBS.test(trimmed) && !isQuestion) {
    const framework = detectFramework(trimmed);
    const needsClarification = !hasExistingThread && !hasSpecificContext(trimmed);
    return {
      type: 'playbook',
      confidence: 'high',
      framework: framework ?? 'Combined',
      extractedDescription: extractDescription(trimmed),
      needsClarification,
    };
  }

  // 4. Softer check — mentions document type + generation verb but didn't match strict pattern
  if (GENERATION_VERBS.test(trimmed) && !isQuestion) {
    const documentType = detectDocumentType(trimmed);
    if (documentType) {
      const needsClarification = !hasExistingThread && !hasSpecificContext(trimmed);
      return {
        type: 'document',
        confidence: 'medium',
        documentType,
        extractedDescription: extractDescription(trimmed),
        needsClarification,
      };
    }

    // Check if they want a playbook without using the exact word
    if (/\b(?:plan|roadmap|guide|checklist)\b/i.test(trimmed)) {
      const framework = detectFramework(trimmed);
      if (framework) {
        const needsClarification = !hasExistingThread && !hasSpecificContext(trimmed);
        return {
          type: 'playbook',
          confidence: 'medium',
          framework,
          extractedDescription: extractDescription(trimmed),
          needsClarification,
        };
      }
    }
  }

  // 5. Default: general advisory question
  return {
    type: 'advisor',
    confidence: isQuestion ? 'high' : 'low',
  };
}

function detectDocumentType(query: string): string | undefined {
  for (const [type, pattern] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    if (pattern.test(query)) return type;
  }
  return undefined;
}

function detectFramework(query: string): string | undefined {
  for (const [framework, pattern] of Object.entries(FRAMEWORK_PATTERNS)) {
    if (pattern.test(query)) return framework;
  }
  return undefined;
}

/**
 * Extract the use case description from a generation request.
 * Strips the generation verb and document type to isolate the subject.
 */
function extractDescription(query: string): string {
  return query
    .replace(/\b(?:generate|create|write|produce|draft|build|make|prepare)\b/gi, '')
    .replace(/\b(?:an?|the|for|my|our|this)\b/gi, '')
    .replace(/\b(?:dpia|threat\s+model|model\s+card|data\s+sheet|human\s+oversight|risk\s+memo|use\s+case\s+summary|vendor.*?sheet|operational\s+readiness|monitoring\s+plan|evidence\s+pack|playbook|roadmap|implementation\s+plan|intake\s+(?:risk\s+)?assessment)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reconcile deterministic classification with LLM classification.
 * Returns the final intent and whether the dispatch is contested.
 */
export function reconcileIntents(
  deterministic: ClassifiedIntent,
  llmIntent?: { type: IntentType; documentType?: string; framework?: string },
): { finalIntent: ClassifiedIntent; contested: boolean } {
  if (!llmIntent) {
    return { finalIntent: deterministic, contested: false };
  }

  // Both agree on type → high confidence
  if (deterministic.type === llmIntent.type) {
    return {
      finalIntent: {
        ...deterministic,
        confidence: 'high',
        documentType: deterministic.documentType ?? llmIntent.documentType,
        framework: deterministic.framework ?? llmIntent.framework,
      },
      contested: false,
    };
  }

  // Deterministic was high confidence but LLM disagrees → trust deterministic for explicit patterns
  if (deterministic.confidence === 'high') {
    return { finalIntent: deterministic, contested: true };
  }

  // Deterministic was low confidence → trust LLM
  if (deterministic.confidence === 'low') {
    return {
      finalIntent: {
        type: llmIntent.type,
        confidence: 'medium',
        documentType: llmIntent.documentType,
        framework: llmIntent.framework,
        extractedDescription: deterministic.extractedDescription,
      },
      contested: false,
    };
  }

  // Both medium confidence but disagree → contested
  return { finalIntent: deterministic, contested: true };
}