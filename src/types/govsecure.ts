/**
 * GovSecure Content Library — Type Definitions
 *
 * Mirrors the JSON shape produced by `scripts/ingestGovSecureLibrary.py`
 * (Phase 0 of the integration plan) plus higher-level domain types layered
 * on top of the raw extraction (AI Chef stations/recipes, blueprint phases,
 * policy suite tiers, NIST RCM controls, risk model tiers).
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.1
 */

// ─── Raw extraction shape (matches Phase 0 JSON) ────────────────────────────

export interface ExtractedSection {
  id: string;
  heading: string;
  level: number;
  paragraphs: string[];
  bullets: string[];
  tables: string[][][];
}

export interface ExtractedDocumentStats {
  section_count?: number;
  paragraph_count?: number;
  bullet_count?: number;
  table_count?: number;
  sheet_count?: number;
  total_rows?: number;
  char_count?: number;
}

export type GovSecureCategory =
  | 'policies'
  | 'checklists'
  | 'playbooks'
  | 'frameworks'
  | 'questionnaires';

export type GovSecureFormat = 'docx' | 'pdf' | 'xlsx';

export interface ExtractedDocument {
  documentCode: string;
  category: GovSecureCategory;
  subType: string;
  title: string;
  sourcePath: string;
  sourceSuffix: string;
  format: GovSecureFormat;
  checksum: string;
  extractedAt: string;
  sections: ExtractedSection[];
  stats: ExtractedDocumentStats;
}

export interface ManifestEntry {
  documentCode: string;
  category: GovSecureCategory;
  subType: string;
  title: string;
  sourcePath: string;
  outputPath: string;
  format: GovSecureFormat;
  checksum: string;
  stats: ExtractedDocumentStats;
}

export interface Manifest {
  generatedAt: string;
  sourceRoot: string;
  documentCount: number;
  byCategory: Record<string, number>;
  documents: ManifestEntry[];
}

// ─── AI Chef Operating Model ────────────────────────────────────────────────

export type GovSecureRiskTier = 'Low' | 'Moderate' | 'High' | 'Prohibited';

export interface RaciAssignment {
  responsible: string;
  accountable: string;
  consulted: string[];
  informed: string[];
}

export interface GovsecureRecipe {
  id: string;
  stationId: string;
  name: string;
  riskTier: GovSecureRiskTier | 'Mixed';
  purpose: string;
  activities: string[];
  deliverables: string[];
  raci?: RaciAssignment;
}

export interface GovsecureStation {
  id: string;
  name: string;
  purpose: string;
  recipes: GovsecureRecipe[];
}

export interface AIChefToolkit {
  version: string;
  positioning: string;
  primaryBuyer: string;
  stations: GovsecureStation[];
  workedExample?: {
    company: string;
    profile: string;
    scenario: string;
  };
}

// ─── 90-Day Implementation Blueprint ────────────────────────────────────────

export interface BlueprintWeek {
  weekRange: string; // e.g. "Weeks 1-2"
  focus: string;
  activities: string[];
  deliverables: string[];
  checklistRefs: string[];
}

export interface BlueprintPhase {
  id: string; // e.g. "phase-1"
  name: string; // "Phase 1 — Foundation"
  durationDays: number;
  objectives: string[];
  successCriteria: string[];
  weeks: BlueprintWeek[];
  nistFunctionAlignment: Array<'GOVERN' | 'MAP' | 'MEASURE' | 'MANAGE'>;
}

export interface BlueprintModel {
  version: string;
  audience: string; // SMB targeting
  totalDurationDays: number; // 90
  phases: BlueprintPhase[];
  coreRoles: Array<{ role: string; responsibilities: string }>;
}

// ─── Policy Suite Map ───────────────────────────────────────────────────────

export type PolicySuiteTier = 'Starter' | 'Operational' | 'Maturity';

export interface PolicyEntry {
  id: string;
  name: string;
  tier: PolicySuiteTier;
  scope: string;
  primaryOwner: string;
  audience: string[];
  companionTemplates: string[];
  satisfies: {
    nist?: string[]; // E.g. ["GOVERN-1", "MAP-2"]
    iso42001?: string[]; // E.g. ["Clause 6", "Clause 8"]
    euAiAct?: string[]; // E.g. ["Article 9", "Article 13"]
    gdpr?: string[]; // E.g. ["Article 25", "Article 35"]
  };
}

export interface PolicySuiteMap {
  tiers: Array<{
    tier: PolicySuiteTier;
    description: string;
    policies: PolicyEntry[];
  }>;
}

// ─── 4-Tier Risk Model ──────────────────────────────────────────────────────

export interface RiskTierDefinition {
  tier: GovSecureRiskTier;
  numericLevel: number; // 1=Low, 2=Moderate, 3=High, 4=Prohibited
  shortDescription: string;
  examples: string[];
  decisionCriteria: string[];
  triggers: string[]; // Auto-elevation conditions
  requiredGovernance: string[];
  reviewCadence: string;
}

export interface RiskTierModel {
  version: string;
  tiers: RiskTierDefinition[];
  scoringDimensions: Array<{
    name: string;
    description: string;
    scale: string; // e.g. "1-4"
  }>;
}

// ─── NIST Risk Control Matrix ───────────────────────────────────────────────

export type NISTFunction = 'GOVERN' | 'MAP' | 'MEASURE' | 'MANAGE';

export interface NISTControl {
  controlId: string; // e.g. "1.1"
  riskCategoryId: string; // e.g. "1.0"
  riskCategory: string; // e.g. "AI Governance and Risk Management"
  riskStatement: string;
  riskExample?: string;
  riskRootCause?: string;
  controlObjective: string;
  controlDescription?: string;
  function?: NISTFunction;
  smbGuidance?: string;
}

// ─── TPRM Questionnaire ─────────────────────────────────────────────────────

export type TPRMResponseType =
  | 'short-answer'
  | 'long-answer'
  | 'yes-no'
  | 'yes-no-partial'
  | 'select-all'
  | 'attachment'
  | 'date';

export interface TPRMQuestion {
  id: string; // e.g. "1.1"
  text: string;
  responseType: TPRMResponseType;
  evidenceRequested?: string;
  scoringRubric?: Record<string, string>; // "1" -> "Informational / low concern"
  redFlagTrigger?: string;
}

export interface TPRMSection {
  id: string;
  name: string;
  importance: 'Required' | 'High' | 'Medium' | 'Low';
  questionCount: number;
  questions: TPRMQuestion[];
}

export interface TPRMQuestionnaire {
  version: string;
  scoringScale: { min: number; max: number; description: string };
  sections: TPRMSection[];
}
