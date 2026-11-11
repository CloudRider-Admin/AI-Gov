/**
 * Use-case-specific intake profile — captures the GovSecure
 * `AI_Use_Case_Intake_Form` Section A (Request Profile), Section C
 * (Tool / Vendor / Deployment), and a flattened Section D (Data Profile)
 * before the IntakeOrchestrator is allowed to score.
 *
 * Why this exists: prior to this module, `orchestratorDispatch` called
 * `intakeOrchestrator.run({ useCaseDescription, conversationId })` with no
 * structured profile. The orchestrator's user-prompt then defaulted owner /
 * businessUnit / jurisdictions / deployment to `"Not specified"` /
 * `"Internal"` and the LLM filled the gap by *inventing* controls
 * (e.g. "Vendor DPA in place", "human-in-the-loop oversight") in the
 * driver-note narrative. That is a hallucination on a compliance artifact.
 *
 * This module:
 *   - Defines `IntakeProfile` mirroring the GovSecure intake form.
 *   - Extracts profile fields from a free-text user message.
 *   - Reports completeness so the dispatcher can ask for missing pieces
 *     before scoring.
 *   - Persists alongside `OrgContext` on `Conversation.metadata`.
 *
 * @see /workspaces/AI-Gov/src/data/govsecureContent/checklists/use-case-intake-form.json
 * @see GovSecure_AI_Use_Case_Intake_Form.pdf, Sections A/B/C/D
 */

import { prisma } from '@/lib/prisma';

export type DeploymentScope = 'Internal' | 'Customer-facing' | 'Public-facing';
export type ImplementationStage = 'Idea' | 'Pilot' | 'Live' | 'Change';
export type ModelType = 'GenAI' | 'Predictive ML' | 'Rules + ML' | 'Vendor Feature';
export type ErrorTolerance = 'Low' | 'Medium' | 'High';
export type DecisionDomain = 'HR' | 'Finance' | 'Legal' | 'Ops' | 'Customer' | 'Other';

/** Coarse data-category flags from intake form Section D. */
export interface DataCategoryFlags {
  publicData?: boolean;
  internalConfidential?: boolean;
  customerData?: boolean;
  employeeData?: boolean;
  financialOrRegulated?: boolean;
  sourceCodeOrCredentials?: boolean;
  personalOrSensitive?: boolean;
}

export interface IntakeProfile {
  // ── Section A — Request profile ───────────────────────────────────
  useCaseName?: string;
  businessOwner?: string;        // Name + title of the person accountable
  department?: string;           // Department / Function
  requesterName?: string;
  requesterEmail?: string;
  implementationStage?: ImplementationStage;
  goLiveTarget?: string;         // ISO date or free-text target

  // ── Section C — Tool / Vendor / Deployment ────────────────────────
  aiToolName?: string;           // e.g. "OpenAI GPT-4o chatbot"
  vendor?: string;
  modelProvider?: string;
  modelType?: ModelType;
  deploymentScope?: DeploymentScope;
  customerFacing?: boolean;      // Derived from deploymentScope
  subprocessors?: string[];
  integrations?: string[];

  // ── Section D — Data profile (coarse) ─────────────────────────────
  dataCategories?: DataCategoryFlags;

  // ── Section E — Output / decision impact ──────────────────────────
  decisionDomain?: DecisionDomain;
  humanReviewMode?: 'Always' | 'Sometimes' | 'Never';
  errorTolerance?: ErrorTolerance;
  fallbackProcess?: string;

  /** ISO timestamp last touched. */
  updatedAt?: string;
}

/** Field IDs used for completeness reporting. Order matches GovSecure form. */
export type IntakeFieldId =
  | 'useCaseName'
  | 'businessOwner'
  | 'department'
  | 'aiToolName'
  | 'vendor'
  | 'deploymentScope'
  | 'goLiveTarget'
  | 'modelProvider'
  | 'dataCategories'
  | 'humanReviewMode';

/**
 * Fields that must be present before the IntakeOrchestrator is allowed
 * to score. These are the GovSecure Section A/C/D minimum that lets the
 * scorer reason without inventing context.
 */
export const REQUIRED_INTAKE_FIELDS: IntakeFieldId[] = [
  'useCaseName',
  'businessOwner',
  'aiToolName',
  'vendor',
  'deploymentScope',
  'dataCategories',
  'humanReviewMode',
];

/** Human-readable prompts mirroring the GovSecure form copy. */
export const INTAKE_FIELD_PROMPTS: Record<IntakeFieldId, string> = {
  useCaseName:
    'What is this AI use case called? (a short name, e.g. "Customer-Service Chatbot")',
  businessOwner:
    'Who is the named business owner accountable for this use case? (name and title)',
  department:
    'Which department or function is sponsoring this use case?',
  aiToolName:
    'What AI tool, model, or service will be used? (product name, model family, or build description)',
  vendor:
    'Who is the vendor or model provider? (e.g. OpenAI, Anthropic, in-house) — say "Unknown" if you have not chosen yet',
  deploymentScope:
    'Will this be Internal-only, Customer-facing, or Public-facing?',
  goLiveTarget:
    'What is your target go-live or pilot date?',
  modelProvider:
    'Who hosts or provides the underlying model?',
  dataCategories:
    'What data will the system handle? Tick all that apply: public, internal-confidential, customer/consumer, employee/HR, financial/regulated, source code/credentials, personal/sensitive.',
  humanReviewMode:
    'Will a human review AI outputs before action — Always, Sometimes, or Never?',
};

// ─── Pure helpers ───────────────────────────────────────────────────────────

export function mergeIntakeProfile(
  base: IntakeProfile,
  update: Partial<IntakeProfile>,
): IntakeProfile {
  const out: IntakeProfile = { ...base };
  for (const [key, value] of Object.entries(update) as [keyof IntakeProfile, unknown][]) {
    if (value === undefined || value === null) continue;
    if (key === 'dataCategories') {
      out.dataCategories = { ...(base.dataCategories ?? {}), ...(value as DataCategoryFlags) };
    } else if (Array.isArray(value)) {
      const existing = (out[key] as unknown as string[]) ?? [];
      const merged = Array.from(new Set([...existing, ...(value as string[])]));
      (out as Record<string, unknown>)[key] = merged;
    } else {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

const DEPLOYMENT_PATTERNS: { re: RegExp; value: DeploymentScope }[] = [
  { re: /\b(public[-\s]?facing|consumer[-\s]?facing|public users?|normal people|general public|members? of the public|retail customers?)\b/i, value: 'Public-facing' },
  { re: /\b(customer[-\s]?facing|client[-\s]?facing|external user)\b/i, value: 'Customer-facing' },
  { re: /\b(internal[-\s]?(?:only|use)?|employees? only|staff only|in-?house only)\b/i, value: 'Internal' },
];

const STAGE_PATTERNS: { re: RegExp; value: ImplementationStage }[] = [
  { re: /\b(idea|concept|exploring|considering)\b/i, value: 'Idea' },
  { re: /\b(pilot|proof[-\s]?of[-\s]?concept|poc|prototype|trial)\b/i, value: 'Pilot' },
  { re: /\b(production|live|in[-\s]?production|already deployed|currently using)\b/i, value: 'Live' },
  { re: /\b(material change|expansion|update to existing|new feature on)\b/i, value: 'Change' },
];

const MODEL_TYPE_PATTERNS: { re: RegExp; value: ModelType }[] = [
  { re: /\b(chatbot|copilot|assistant|generative|llm|gpt|chat ?gpt|claude|gemini|gen[-\s]?ai)\b/i, value: 'GenAI' },
  { re: /\b(predictive (?:model|ml)|classification model|regression model|forecasting model|scoring model)\b/i, value: 'Predictive ML' },
  { re: /\b(rules?[-\s]?based|hybrid (?:rules|ml))\b/i, value: 'Rules + ML' },
  { re: /\b(vendor (?:feature|capability)|embedded ai|baked[-\s]?in ai)\b/i, value: 'Vendor Feature' },
];

const HUMAN_REVIEW_PATTERNS: { re: RegExp; value: 'Always' | 'Sometimes' | 'Never' }[] = [
  { re: /\bhumans? (?:always )?review (?:every|all|each) output\b|\balways human[-\s]?in[-\s]?the[-\s]?loop\b/i, value: 'Always' },
  { re: /\bsometimes (?:reviewed?|checked?)\b|\bsample(?:d)? review\b|\bspot[-\s]?check\b/i, value: 'Sometimes' },
  { re: /\bfully automated\b|\bno human review\b|\bautomated decisions?\b|\bno oversight\b/i, value: 'Never' },
];

const VENDOR_PATTERNS: { re: RegExp; value: string }[] = [
  { re: /\bopen ?ai\b/i, value: 'OpenAI' },
  { re: /\banthropic\b/i, value: 'Anthropic' },
  { re: /\bgoogle (?:cloud|gemini|vertex)\b/i, value: 'Google' },
  { re: /\bmicrosoft (?:azure|openai|copilot)\b/i, value: 'Microsoft' },
  { re: /\baws\b|\bbedrock\b/i, value: 'AWS' },
  { re: /\bmistral\b/i, value: 'Mistral' },
  { re: /\bmeta\b|\bllama\b/i, value: 'Meta' },
  { re: /\b(in[-\s]?house|self[-\s]?hosted|home[-\s]?grown|built ourselves)\b/i, value: 'In-house' },
];

const DATA_CATEGORY_PATTERNS: { re: RegExp; key: keyof DataCategoryFlags }[] = [
  { re: /\b(pii|personally identifiable|personal data|sensitive personal)\b/i, key: 'personalOrSensitive' },
  { re: /\b(financial data|bank(?:ing)? data|payment data|account numbers?|transaction(?:s)? data|credit card|pci)\b/i, key: 'financialOrRegulated' },
  { re: /\b(phi|health data|medical record|patient data|hipaa)\b/i, key: 'financialOrRegulated' },
  { re: /\b(employee data|hr data|payroll|personnel)\b/i, key: 'employeeData' },
  { re: /\b(customer data|consumer data|client data)\b/i, key: 'customerData' },
  { re: /\b(internal (?:document|confidential)|company confidential|business confidential)\b/i, key: 'internalConfidential' },
  { re: /\b(source code|credentials|secrets|api keys?|tokens?)\b/i, key: 'sourceCodeOrCredentials' },
  { re: /\b(public (?:data|information)|publicly available)\b/i, key: 'publicData' },
];

// ─── Answers to Govi's intake questions ────────────────────────────────────
//
// When the user answers the clarification card, the client sends:
//
//   <original request>
//
//   Here are the details you asked for:
//   Q: <question copy>
//   A: <answer>
//
// The question copy itself names options ("Internal-only, Customer-facing, or
// Public-facing", "e.g. OpenAI", "source code/credentials", a quoted example
// use-case name). Running the free-text regexes over it captured those
// examples as if the user had said them, and answers like "Cloudrider LLC" or
// "Always" never matched the free-text patterns at all, so the same questions
// were asked forever. Answers to our own intake questions are therefore mapped
// to their field directly, and question lines never reach the regexes.

export const INTAKE_ANSWERS_HEADER = 'Here are the details you asked for:';

const QA_HEADER_RE = /^\s*Here are the details you asked for:\s*$/i;
const Q_LINE_RE = /^\s*Q:\s*(.*)$/;
const A_LINE_RE = /^\s*A:\s*/;

/** Which intake field a question asks for, when it is one of our own prompts. */
export function intakeFieldForQuestion(question: string): IntakeFieldId | undefined {
  const q = question.trim().toLowerCase();
  for (const [field, prompt] of Object.entries(INTAKE_FIELD_PROMPTS) as [IntakeFieldId, string][]) {
    const p = prompt.toLowerCase();
    if (q === p || q.startsWith(p.slice(0, 40))) return field;
  }
  return undefined;
}

function matchVendor(text: string): string | undefined {
  return VENDOR_PATTERNS.find(({ re }) => re.test(text))?.value;
}

function parseDeploymentAnswer(answer: string): DeploymentScope | undefined {
  // Most-exposed wins when several are named ("internal and customer-facing").
  if (/\bpublic\b/i.test(answer)) return 'Public-facing';
  if (/\b(customers?|clients?|external|consumers?)\b/i.test(answer)) return 'Customer-facing';
  if (/\b(internal|employees?|staff|in[-\s]?house)\b/i.test(answer)) return 'Internal';
  return undefined;
}

function parseHumanReviewAnswer(answer: string): IntakeProfile['humanReviewMode'] {
  if (/\bnot always\b|\bsometimes\b|\bspot[-\s]?check|\bsampl|\boccasional|\bdepends\b/i.test(answer)) return 'Sometimes';
  if (/\balways\b|\bevery\b|\ball outputs?\b|\b100\s?%/i.test(answer)) return 'Always';
  if (/\bnever\b|^\s*no\b|\bfully automated\b|\bno human\b/i.test(answer)) return 'Never';
  // "Yes" is ambiguous between Always and Sometimes; leave it unanswered.
  return undefined;
}

function parseDataCategoriesAnswer(answer: string): DataCategoryFlags | undefined {
  const flags: DataCategoryFlags = {};
  if (/\bpublic\b/i.test(answer)) flags.publicData = true;
  if (/\binternal\b|\bconfidential\b/i.test(answer)) flags.internalConfidential = true;
  if (/\bcustomers?\b|\bconsumers?\b|\bclients?\b/i.test(answer)) flags.customerData = true;
  if (/\bemployees?\b|\bhr\b|\bstaff\b|\bpersonnel\b|\bpayroll\b/i.test(answer)) flags.employeeData = true;
  if (/\bfinancial\b|\bregulated\b|\bpayments?\b|\bbank(?:ing)?\b|\bcredit card/i.test(answer)) flags.financialOrRegulated = true;
  if (/\bphi\b|\bhealth\b|\bmedical\b|\bpatients?\b|\bhipaa\b/i.test(answer)) {
    flags.financialOrRegulated = true;
    flags.personalOrSensitive = true;
  }
  if (/\bsource code\b|\bcredentials?\b|\bsecrets?\b|\bapi keys?\b/i.test(answer)) flags.sourceCodeOrCredentials = true;
  if (/\bpersonal\b|\bsensitive\b|\bpii\b/i.test(answer)) flags.personalOrSensitive = true;
  return Object.keys(flags).length ? flags : undefined;
}

/** Normalise one answer for one intake field. Empty when it can't be used. */
export function intakeUpdateFromAnswer(field: IntakeFieldId, rawAnswer: string): Partial<IntakeProfile> {
  const answer = rawAnswer.trim().slice(0, 200);
  if (!answer || /^(skip(ped)?|n\/?a|-+)$/i.test(answer)) return {};
  switch (field) {
    case 'useCaseName':
    case 'businessOwner':
    case 'department':
    case 'goLiveTarget':
      return { [field]: answer };
    case 'aiToolName': {
      const update: Partial<IntakeProfile> = { aiToolName: answer };
      const modelType = MODEL_TYPE_PATTERNS.find(({ re }) => re.test(answer))?.value;
      if (modelType) update.modelType = modelType;
      return update;
    }
    case 'vendor':
    case 'modelProvider':
      return { [field]: matchVendor(answer) ?? answer };
    case 'deploymentScope': {
      const scope = parseDeploymentAnswer(answer);
      return scope ? { deploymentScope: scope, customerFacing: scope !== 'Internal' } : {};
    }
    case 'humanReviewMode': {
      const mode = parseHumanReviewAnswer(answer);
      return mode ? { humanReviewMode: mode } : {};
    }
    case 'dataCategories': {
      const flags = parseDataCategoriesAnswer(answer);
      return flags ? { dataCategories: flags } : {};
    }
  }
}

/**
 * Split a message into (a) updates from answers to our own intake questions
 * and (b) the remaining free text — the original request plus answers to
 * questions we can't map — with every question line removed.
 */
export function splitIntakeAnswers(text: string): { structured: Partial<IntakeProfile>; freeText: string } {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let structured: IntakeProfile = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (QA_HEADER_RE.test(line)) {
      i++;
      continue;
    }
    const q = line.match(Q_LINE_RE);
    if (!q) {
      kept.push(line);
      i++;
      continue;
    }
    const field = intakeFieldForQuestion(q[1]);
    const answerLines: string[] = [];
    i++;
    if (i < lines.length && A_LINE_RE.test(lines[i])) {
      answerLines.push(lines[i].replace(A_LINE_RE, ''));
      i++;
      while (i < lines.length && lines[i].trim() && !Q_LINE_RE.test(lines[i]) && !QA_HEADER_RE.test(lines[i])) {
        answerLines.push(lines[i]);
        i++;
      }
    }
    const answer = answerLines.join('\n').trim();
    if (field) {
      structured = mergeIntakeProfile(structured, intakeUpdateFromAnswer(field, answer));
    } else if (answer) {
      kept.push(answer);
    }
  }
  return { structured, freeText: kept.join('\n') };
}

/**
 * Best-effort extraction of intake profile fields from a user message.
 * Answers to Govi's own intake questions are mapped field-by-field; the rest
 * is scanned with free-text patterns. Pure; returns only fields it could find
 * with reasonable confidence. Combine with `mergeIntakeProfile` to accumulate
 * over turns.
 */
export function extractIntakeProfileFromText(input: string): Partial<IntakeProfile> {
  if (!input) return {};
  const { structured, freeText: text } = splitIntakeAnswers(input);
  const update: Partial<IntakeProfile> = {};

  for (const { re, value } of DEPLOYMENT_PATTERNS) {
    if (re.test(text)) {
      update.deploymentScope = value;
      update.customerFacing = value !== 'Internal';
      break;
    }
  }

  for (const { re, value } of STAGE_PATTERNS) {
    if (re.test(text)) {
      update.implementationStage = value;
      break;
    }
  }

  for (const { re, value } of MODEL_TYPE_PATTERNS) {
    if (re.test(text)) {
      update.modelType = value;
      break;
    }
  }

  for (const { re, value } of HUMAN_REVIEW_PATTERNS) {
    if (re.test(text)) {
      update.humanReviewMode = value;
      break;
    }
  }

  for (const { re, value } of VENDOR_PATTERNS) {
    if (re.test(text)) {
      update.vendor = value;
      // Most are also the model provider unless overridden later
      if (!update.modelProvider) update.modelProvider = value;
      break;
    }
  }

  const dataFlags: DataCategoryFlags = {};
  for (const { re, key } of DATA_CATEGORY_PATTERNS) {
    if (re.test(text)) dataFlags[key] = true;
  }
  if (Object.keys(dataFlags).length) update.dataCategories = dataFlags;

  // Email — captures requester email
  const emailMatch = text.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
  if (emailMatch) update.requesterEmail = emailMatch[1];

  // Owner pattern: "owner is X", "business owner: X", "X is the owner"
  const ownerMatch = text.match(
    /\b(?:business )?owner(?:\s+is|:|\s+will be)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/,
  );
  if (ownerMatch) update.businessOwner = ownerMatch[1].trim();

  // Use case name in quotes or after "called"
  const nameMatch =
    text.match(/(?:called|named)\s+["']?([A-Z][\w\s-]{2,40}?)["']?(?:\.|,|$)/) ||
    text.match(/["']([A-Z][\w\s-]{3,40})["']/);
  if (nameMatch) update.useCaseName = nameMatch[1].trim();

  // Go-live: "go-live in Q3", "by 2026-09-01", "launching next quarter"
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) update.goLiveTarget = dateMatch[1];
  const quarterMatch = text.match(/\b(Q[1-4]\s+\d{4}|H[12]\s+\d{4})\b/);
  if (!update.goLiveTarget && quarterMatch) update.goLiveTarget = quarterMatch[1];

  // Direct answers to our own questions win over anything inferred above.
  return mergeIntakeProfile(update, structured);
}

// ─── Completeness ──────────────────────────────────────────────────────────

export interface CompletenessReport {
  ok: boolean;
  missing: IntakeFieldId[];
  questions: string[];
  /** 0..1 — fraction of required fields present. */
  completeness: number;
}

function isFieldPresent(profile: IntakeProfile, field: IntakeFieldId): boolean {
  if (field === 'dataCategories') {
    return Boolean(profile.dataCategories && Object.keys(profile.dataCategories).length > 0);
  }
  const value = profile[field as keyof IntakeProfile];
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Decide whether the intake profile is complete enough for the orchestrator
 * to score without inventing context. Returns the missing fields plus
 * GovSecure-form-style questions to ask the user next.
 */
export function assessIntakeProfileCompleteness(
  profile: IntakeProfile,
): CompletenessReport {
  const missing = REQUIRED_INTAKE_FIELDS.filter(f => !isFieldPresent(profile, f));
  const questions = missing.map(f => INTAKE_FIELD_PROMPTS[f]);
  const completeness =
    (REQUIRED_INTAKE_FIELDS.length - missing.length) / REQUIRED_INTAKE_FIELDS.length;
  return { ok: missing.length === 0, missing, questions, completeness };
}

const INTAKE_FIELD_LABELS: Record<IntakeFieldId, string> = {
  useCaseName: 'Use case',
  businessOwner: 'Owner',
  department: 'Department',
  aiToolName: 'AI tool',
  vendor: 'Vendor',
  deploymentScope: 'Deployment',
  goLiveTarget: 'Go-live',
  modelProvider: 'Model provider',
  dataCategories: 'Data',
  humanReviewMode: 'Human review',
};

const DATA_CATEGORY_LABELS: Record<keyof DataCategoryFlags, string> = {
  publicData: 'public',
  internalConfidential: 'internal-confidential',
  customerData: 'customer/consumer',
  employeeData: 'employee/HR',
  financialOrRegulated: 'financial/regulated',
  sourceCodeOrCredentials: 'source code/credentials',
  personalOrSensitive: 'personal/sensitive',
};

function formatIntakeValue(profile: IntakeProfile, field: IntakeFieldId): string {
  if (field === 'dataCategories') {
    return (Object.keys(profile.dataCategories ?? {}) as (keyof DataCategoryFlags)[])
      .filter((k) => profile.dataCategories?.[k])
      .map((k) => DATA_CATEGORY_LABELS[k])
      .join(', ');
  }
  return String(profile[field as keyof IntakeProfile] ?? '');
}

/**
 * The message Govi shows while the intake is incomplete: what it has recorded
 * so far and how many details are still needed. Replaces the model's own
 * narrative, which would otherwise read as a finished (invented) assessment.
 */
export function describeIntakeProgress(profile: IntakeProfile, missing: IntakeFieldId[]): string {
  const captured = REQUIRED_INTAKE_FIELDS.filter((f) => !missing.includes(f))
    .map((f) => `${INTAKE_FIELD_LABELS[f]}: ${formatIntakeValue(profile, f)}`)
    .filter((line) => !line.endsWith(': '));
  const need = missing.length === 1 ? '1 more detail' : `${missing.length} more details`;
  const head = `To score this risk assessment I need ${need} for the intake form.`;
  return captured.length ? `${head} Recorded so far — ${captured.join('; ')}.` : head;
}

/** Clickable answers for intake questions with a fixed set of options. */
const INTAKE_FIELD_CHOICES: Partial<Record<IntakeFieldId, { options: string[]; multiSelect?: boolean }>> = {
  vendor: { options: ['OpenAI', 'Anthropic', 'Google', 'Microsoft', 'In-house', 'Unknown'] },
  deploymentScope: { options: ['Internal-only', 'Customer-facing', 'Public-facing'] },
  dataCategories: {
    options: [
      'Public',
      'Internal-confidential',
      'Customer/consumer',
      'Employee/HR',
      'Financial/regulated',
      'Source code/credentials',
      'Personal/sensitive',
    ],
    multiSelect: true,
  },
  humanReviewMode: { options: ['Always', 'Sometimes', 'Never'] },
};

/** Index-aligned with `missing` (and so with the completeness questions). */
export function intakeChoicesFor(
  missing: IntakeFieldId[],
): ({ options: string[]; multiSelect?: boolean } | null)[] {
  return missing.map((f) => INTAKE_FIELD_CHOICES[f] ?? null);
}

// ─── Persistence ────────────────────────────────────────────────────────────
//
// `IntakeProfile` shares `Conversation.metadata` with `OrgContext`. The blob
// shape is:
//
//   {
//     ...orgContextFields,
//     _intakeProfile?: IntakeProfile,
//   }
//
// We use `_intakeProfile` (underscore-prefixed) so the existing OrgContext
// reader treats it as an unknown field and ignores it gracefully.

const METADATA_KEY = '_intakeProfile';

interface MetadataBlob {
  [k: string]: unknown;
  _intakeProfile?: IntakeProfile;
}

async function readMetadata(conversationId: string): Promise<MetadataBlob> {
  if (!conversationId) return {};
  try {
    const row = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    });
    if (!row?.metadata) return {};
    return JSON.parse(row.metadata) as MetadataBlob;
  } catch {
    return {};
  }
}

async function writeMetadata(conversationId: string, blob: MetadataBlob): Promise<void> {
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: JSON.stringify(blob) },
    });
  } catch {
    // Non-fatal — intake profile is best-effort metadata.
  }
}

export async function getIntakeProfile(conversationId: string): Promise<IntakeProfile> {
  if (!conversationId) return {};
  const blob = await readMetadata(conversationId);
  return (blob[METADATA_KEY] as IntakeProfile) ?? {};
}

export async function updateIntakeProfile(
  conversationId: string,
  updates: Partial<IntakeProfile>,
): Promise<IntakeProfile> {
  if (!conversationId) return {};
  const blob = await readMetadata(conversationId);
  const current = (blob[METADATA_KEY] as IntakeProfile) ?? {};
  const merged = mergeIntakeProfile(current, updates);
  if (Object.keys(merged).length === 0) return merged;
  merged.updatedAt = new Date().toISOString();
  blob[METADATA_KEY] = merged;
  await writeMetadata(conversationId, blob);
  return merged;
}

/**
 * Convenience wrapper: extract from `text`, persist, and return the merged
 * profile. Used by `orchestratorDispatch` after every user turn so the
 * profile accumulates without explicit form submission.
 */
export async function captureIntakeProfile(
  conversationId: string,
  text: string,
): Promise<IntakeProfile> {
  if (!conversationId) return {};
  const update = extractIntakeProfileFromText(text);
  if (Object.keys(update).length === 0) return getIntakeProfile(conversationId);
  return updateIntakeProfile(conversationId, update);
}

/**
 * Flatten the profile into the shape `IntakeOrchestrator.run()` expects.
 * Maps GovSecure fields → orchestrator IntakeRequest fields.
 */
export function intakeProfileToOrchestratorInput(
  profile: IntakeProfile,
  jurisdictions: string[] | undefined,
): {
  useCaseName?: string;
  owner?: string;
  businessUnit?: string;
  modelType?: ModelType;
  deployment?: DeploymentScope;
  jurisdictions?: string[];
  goLiveTarget?: string;
} {
  return {
    useCaseName: profile.useCaseName,
    owner: profile.businessOwner,
    businessUnit: profile.department,
    modelType: profile.modelType,
    deployment: profile.deploymentScope,
    jurisdictions,
    goLiveTarget: profile.goLiveTarget,
  };
}

/**
 * Render the captured intake profile as a structured block the orchestrator
 * system prompt can quote. Empty when nothing meaningful was captured.
 */
export function renderIntakeProfileBlock(profile: IntakeProfile): string {
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const flags = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      if (flags.length === 0) return;
      lines.push(`- ${label}: ${flags.join(', ')}`);
      return;
    }
    lines.push(`- ${label}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  };

  push('Use case name', profile.useCaseName);
  push('Business owner', profile.businessOwner);
  push('Department', profile.department);
  push('Requester', profile.requesterName);
  push('Stage', profile.implementationStage);
  push('Go-live target', profile.goLiveTarget);
  push('AI tool / service', profile.aiToolName);
  push('Vendor', profile.vendor);
  push('Model provider', profile.modelProvider);
  push('Model type', profile.modelType);
  push('Deployment scope', profile.deploymentScope);
  push('Subprocessors', profile.subprocessors);
  push('Integrations', profile.integrations);
  push('Data categories present', profile.dataCategories);
  push('Decision domain', profile.decisionDomain);
  push('Human review mode', profile.humanReviewMode);
  push('Error tolerance', profile.errorTolerance);
  push('Fallback process', profile.fallbackProcess);

  if (lines.length === 0) return '';
  return ['INTAKE PROFILE (verbatim from user — do NOT invent fields not listed below):', ...lines].join('\n');
}
