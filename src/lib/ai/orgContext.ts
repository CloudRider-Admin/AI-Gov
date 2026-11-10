/**
 * Cross-document organization context — Phase 4.5.
 *
 * Within a conversation session, generated documents share a single
 * `OrgContext` so role names, escalation paths, AI tool names, and
 * jurisdictions stay consistent across the AUP, the DPIA, the playbook,
 * and the TPRM. Stored on `Conversation.metadata` as JSON-as-string.
 *
 * The module is split into:
 *   - Pure: `extractFromText`, `mergeOrgContext`, `renderOrgContextBlock`.
 *   - I/O:  `getOrgContext`, `updateOrgContext` (Prisma).
 *
 * Pure paths are exported for tests; the I/O paths are what orchestrators
 * call.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 4.5
 */

import { prisma } from '@/lib/prisma';

export interface OrgContext {
  organizationName?: string;
  industry?: string;
  /** Coarse SMB sizing — small (<50), medium (50–500), large (>500). */
  size?: 'small' | 'medium' | 'large';
  /** Headcount when explicitly stated, e.g. 280. */
  headcount?: number;
  /** Title or named individual responsible for AI governance. */
  governanceLeadTitle?: string;
  /** Escalation chain, e.g. ["AI Governance Lead", "VP", "CEO"]. */
  escalationPath?: string[];
  /** Concrete AI tools / vendors in use. */
  knownAITools?: string[];
  /** Self-described risk appetite. */
  riskAppetite?: 'conservative' | 'balanced' | 'aggressive';
  /** ISO-3166 short codes or short jurisdiction labels (e.g. "EU", "US-CA"). */
  jurisdictions?: string[];
  /** ISO timestamp the record was last touched. Set by `updateOrgContext`. */
  updatedAt?: string;
}

const EMPTY_CONTEXT: OrgContext = {};

// ─── Pure helpers ───────────────────────────────────────────────────────────

/** Coarse sizing from headcount. Public for tests. */
export function sizeFromHeadcount(n: number): OrgContext['size'] | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 50) return 'small';
  if (n <= 500) return 'medium';
  return 'large';
}

/**
 * Merge an `update` into an existing `OrgContext`. Arrays are unioned (no
 * duplicates), scalars overwrite, undefined is treated as absent.
 */
export function mergeOrgContext(base: OrgContext, update: Partial<OrgContext>): OrgContext {
  const out: OrgContext = { ...base };
  for (const [key, value] of Object.entries(update) as [keyof OrgContext, unknown][]) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const existing = (out[key] as unknown as string[]) ?? [];
      const merged = Array.from(new Set([...existing, ...(value as string[])]));
      (out as Record<string, unknown>)[key] = merged;
    } else {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

const INDUSTRY_TERMS: Record<string, string> = {
  fintech: 'fintech',
  finserv: 'financial services',
  banking: 'banking',
  insurance: 'insurance',
  healthcare: 'healthcare',
  health: 'healthcare',
  pharma: 'pharmaceutical',
  pharmaceutical: 'pharmaceutical',
  saas: 'saas',
  ecommerce: 'ecommerce',
  'e-commerce': 'ecommerce',
  retail: 'retail',
  manufacturing: 'manufacturing',
  education: 'education',
  edtech: 'education',
  legal: 'legal',
  government: 'public-sector',
  'public-sector': 'public-sector',
  'public sector': 'public-sector',
  staffing: 'staffing',
  media: 'media',
  energy: 'energy',
  telecom: 'telecom',
  logistics: 'logistics',
  agriculture: 'agriculture',
};

const AI_TOOLS_REGEX =
  /\b(ChatGPT(?:\s+Enterprise|\s+Team|\s+Plus)?|Claude(?:\s+(?:for\s+Work|Enterprise|Pro))?|Microsoft\s+Copilot|GitHub\s+Copilot|Gemini(?:\s+Advanced)?|Anthropic\s+Claude|OpenAI\s+(?:GPT-?4o?|o1|o3)|Cursor|Zendesk\s+AI|Perplexity|Mistral|Llama\s*\d+|Grok)\b/gi;

const HEADCOUNT_REGEX = /\b(\d{2,5})[-\s]?(?:person|employee|people|staff|headcount)\b/i;

const JURISDICTION_REGEX =
  /\b(?:in|across|spanning|operate(?:s)?\s+(?:in|across))\s+((?:[A-Z][A-Za-z]+(?:[,\s]+(?:and\s+)?[A-Z][A-Za-z]+)*))\b/g;

/**
 * Token → jurisdiction code(s). A string array value means the token expands
 * to multiple codes (e.g. "North America" → ['US', 'CA']). The extraction
 * loop unions all codes into the captured `jurisdictions` set.
 */
const COUNTRY_TOKENS: Record<string, string | string[]> = {
  us: 'US',
  usa: 'US',
  america: 'US',
  unitedstates: 'US',
  uk: 'UK',
  britain: 'UK',
  unitedkingdom: 'UK',
  eu: 'EU',
  europe: 'EU',
  europeanunion: 'EU',
  eea: 'EEA',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  netherlands: 'NL',
  ireland: 'IE',
  canada: 'CA',
  mexico: 'MX',
  australia: 'AU',
  india: 'IN',
  china: 'CN',
  japan: 'JP',
  singapore: 'SG',
  brazil: 'BR',
  california: 'US-CA',
  texas: 'US-TX',
  newyork: 'US-NY',
  ny: 'US-NY',
  // ── Regions that expand to multiple jurisdictions ──
  northamerica: ['US', 'CA'],
  na: ['US', 'CA'],
  emea: ['EU', 'UK'],
  apac: ['SG', 'AU', 'JP', 'IN'],
  latam: ['MX', 'BR'],
};

const RISK_APPETITE_REGEX = /\b(conservative|balanced|aggressive|risk[-\s]?(?:averse|tolerant))\b/i;

const GOVERNANCE_LEAD_REGEX =
  /\b(VP\s+of\s+\w+|Chief\s+\w+\s+Officer|CISO|CTO|CIO|CDO|Director\s+of\s+\w+|Head\s+of\s+\w+|AI\s+Governance\s+Lead|General\s+Counsel)\b/i;

/**
 * Best-effort extraction of `OrgContext` from a single user message. Pure;
 * returns only fields it could find. Use in combination with `mergeOrgContext`.
 */
export function extractFromText(text: string): Partial<OrgContext> {
  if (!text) return {};
  const update: Partial<OrgContext> = {};

  // Headcount → size
  const headcountMatch = text.match(HEADCOUNT_REGEX);
  if (headcountMatch) {
    const n = Number(headcountMatch[1]);
    if (Number.isFinite(n)) {
      update.headcount = n;
      const size = sizeFromHeadcount(n);
      if (size) update.size = size;
    }
  }

  // Industry — first matching keyword wins
  const lower = text.toLowerCase();
  for (const [needle, label] of Object.entries(INDUSTRY_TERMS)) {
    const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\\\]\\\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      update.industry = label;
      break;
    }
  }

  // AI tools — list everything mentioned
  const tools = new Set<string>();
  for (const m of text.matchAll(AI_TOOLS_REGEX)) {
    tools.add(m[1].replace(/\s+/g, ' '));
  }
  if (tools.size) update.knownAITools = Array.from(tools);

  // Jurisdictions — both explicit "in California" and bare country tokens.
  // Token values may be a single code or an array (e.g. "North America" → US, CA).
  const jurisdictions = new Set<string>();
  const addCode = (val: string | string[] | undefined) => {
    if (!val) return;
    if (Array.isArray(val)) val.forEach(v => jurisdictions.add(v));
    else jurisdictions.add(val);
  };
  for (const m of text.matchAll(JURISDICTION_REGEX)) {
    const block = m[1].toLowerCase().replace(/\s+/g, '');
    for (const part of block.split(/[,]/)) {
      addCode(COUNTRY_TOKENS[part]);
    }
  }
  // Bare country/region tokens fallback. Multi-word tokens (northamerica) are
  // checked against the whitespace-stripped lowercase text; single-word tokens
  // against the original to avoid false hits (e.g. "europe" inside "europeans").
  const stripped = text.replace(/\s+/g, '').toLowerCase();
  for (const [needle, code] of Object.entries(COUNTRY_TOKENS)) {
    const isMultiWord = /[a-z]{8,}/.test(needle) && (needle === 'northamerica' || needle === 'unitedstates' || needle === 'unitedkingdom' || needle === 'europeanunion');
    if (isMultiWord) {
      if (stripped.includes(needle)) addCode(code);
    } else {
      const re = new RegExp(`\\b${needle}\\b`, 'i');
      if (re.test(text)) addCode(code);
    }
  }
  if (jurisdictions.size) update.jurisdictions = Array.from(jurisdictions);

  // Risk appetite
  const appetite = text.match(RISK_APPETITE_REGEX);
  if (appetite) {
    const raw = appetite[1].toLowerCase();
    if (raw.includes('averse') || raw === 'conservative') update.riskAppetite = 'conservative';
    else if (raw.includes('tolerant') || raw === 'aggressive') update.riskAppetite = 'aggressive';
    else if (raw === 'balanced') update.riskAppetite = 'balanced';
  }

  // Governance lead title
  const lead = text.match(GOVERNANCE_LEAD_REGEX);
  if (lead) update.governanceLeadTitle = lead[1].replace(/\s+/g, ' ').trim();

  return update;
}

/**
 * Render the org context as an `ORGANIZATION CONTEXT` prompt block. Returns
 * an empty string when nothing was captured so callers can concatenate
 * unconditionally.
 */
export function renderOrgContextBlock(ctx: OrgContext): string {
  if (!hasAnySignal(ctx)) return '';
  const lines: string[] = ['ORGANIZATION CONTEXT (apply consistently across all generated documents):'];
  if (ctx.organizationName) lines.push(`- Organization: ${ctx.organizationName}`);
  if (ctx.industry || ctx.size || ctx.headcount) {
    const bits = [
      ctx.headcount ? `${ctx.headcount}-person` : ctx.size ? `${ctx.size} (50–500 employees)`.replace('small (50–500 employees)', 'small (<50 employees)').replace('large (50–500 employees)', 'large (>500 employees)') : null,
      ctx.industry ?? null,
      'organization',
    ].filter(Boolean);
    lines.push(`- Profile: ${bits.join(' ')}`);
  }
  if (ctx.governanceLeadTitle) lines.push(`- AI Governance Lead: ${ctx.governanceLeadTitle}`);
  if (ctx.escalationPath?.length) lines.push(`- Escalation path: ${ctx.escalationPath.join(' → ')}`);
  if (ctx.knownAITools?.length) lines.push(`- Known AI tools in use: ${ctx.knownAITools.join(', ')}`);
  if (ctx.jurisdictions?.length) lines.push(`- Jurisdictions: ${ctx.jurisdictions.join(', ')}`);
  if (ctx.riskAppetite) lines.push(`- Risk appetite: ${ctx.riskAppetite}`);
  return lines.join('\n');
}

function hasAnySignal(ctx: OrgContext): boolean {
  return Boolean(
    ctx.organizationName ||
      ctx.industry ||
      ctx.size ||
      ctx.headcount ||
      ctx.governanceLeadTitle ||
      ctx.escalationPath?.length ||
      ctx.knownAITools?.length ||
      ctx.jurisdictions?.length ||
      ctx.riskAppetite,
  );
}

// ─── Persistence ────────────────────────────────────────────────────────────

/** Read the org context from `Conversation.metadata`. Returns `{}` when missing. */
export async function getOrgContext(conversationId: string): Promise<OrgContext> {
  if (!conversationId) return EMPTY_CONTEXT;
  try {
    const row = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    });
    if (!row?.metadata) return EMPTY_CONTEXT;
    return JSON.parse(row.metadata) as OrgContext;
  } catch {
    return EMPTY_CONTEXT;
  }
}

/**
 * Merge `updates` into the conversation's existing `OrgContext` and persist.
 * Returns the merged result. No-op when nothing meaningful was provided.
 */
export async function updateOrgContext(
  conversationId: string,
  updates: Partial<OrgContext>,
): Promise<OrgContext> {
  if (!conversationId) return EMPTY_CONTEXT;
  const current = await getOrgContext(conversationId);
  const merged = mergeOrgContext(current, updates);
  if (!hasAnySignal(merged)) return merged;
  merged.updatedAt = new Date().toISOString();
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: JSON.stringify(merged) },
    });
  } catch {
    // Non-fatal — orgContext is best-effort metadata.
  }
  return merged;
}

/**
 * Convenience wrapper that extracts from `text` and persists in one call.
 * Used by `orchestratorDispatch` after every user turn.
 */
export async function captureOrgContext(
  conversationId: string,
  text: string,
): Promise<OrgContext> {
  const update = extractFromText(text);
  if (Object.keys(update).length === 0) return getOrgContext(conversationId);
  return updateOrgContext(conversationId, update);
}
