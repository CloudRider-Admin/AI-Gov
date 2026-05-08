/**
 * Eval Harness — shared types
 *
 * Phase 1.5 of the GovSecure integration plan. Defines the golden-case
 * format, deterministic + judged score components, and per-run report
 * shape consumed by the runner and CI workflow.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 1.5
 */

export type GoldenCategory =
  | 'document-generation'
  | 'advisory-query'
  | 'intake'
  | 'playbook';

export interface DocumentGenerationGolden {
  id: string;
  category: 'document-generation';
  documentType: string;
  input: {
    useCaseName?: string;
    useCaseDescription: string;
    industry?: string;
    riskTier: 'Low' | 'Medium' | 'High' | 'Critical';
    context?: string;
  };
  expectedSections: string[];
  requiredClauses: string[];
  forbiddenContent: string[];
  exemplarPath?: string;
  voiceTargetSections?: string[];
}

export interface AdvisoryGolden {
  id: string;
  category: 'advisory-query';
  input: {
    message: string;
  };
  /** Substrings that must appear somewhere in the rendered advisor response. */
  requiredClauses: string[];
  /** Substrings that must NOT appear. Used to catch fabricated citations. */
  forbiddenContent: string[];
  /** Expected high-level intent classification. */
  expectedIntent?: 'advisor' | 'intake' | 'document' | 'playbook';
}

export interface IntakeGolden {
  id: string;
  category: 'intake';
  input: {
    useCaseName?: string;
    useCaseDescription: string;
    industry?: string;
  };
  expectedRiskTier: 'Low' | 'Medium' | 'High' | 'Critical';
  /** Auto-high triggers we expect to fire. */
  expectedTriggers?: string[];
  requiredClauses: string[];
  forbiddenContent: string[];
}

export interface PlaybookGolden {
  id: string;
  category: 'playbook';
  input: {
    framework: 'NIST AI RMF' | 'EU AI Act' | 'ISO/IEC 42001' | 'Combined';
    riskTier: 'Low' | 'Medium' | 'High' | 'Critical';
    useCaseDescription: string;
    useCaseName?: string;
    focusAreas?: string[];
  };
  expectedPhases: string[];
  requiredClauses: string[];
  forbiddenContent: string[];
}

export type GoldenCase =
  | DocumentGenerationGolden
  | AdvisoryGolden
  | IntakeGolden
  | PlaybookGolden;

export interface DeterministicScore {
  /** Fraction of `expectedSections` (or expected phases / triggers) found in output. */
  structureMatch: number;
  /** Fraction of `requiredClauses` found. */
  requiredClausesPresent: number;
  /** `pass` when no `forbiddenContent` is present and no obvious fabricated citations. */
  hallucinationCheck: 'pass' | 'fail';
  /** Specific clauses that were missing — useful for the report. */
  missingClauses: string[];
  /** Specific forbidden strings that were detected. */
  forbiddenHits: string[];
  /** Number of citations that failed validateCitations(). Phase 1.6 hard gate. */
  unverifiedCitationCount?: number;
  /** Up to 5 examples of the unverified citations, for the report. */
  unverifiedCitationSamples?: string[];
}

export interface JudgedScore {
  /** 0–1 voice/style match against an exemplar. Optional — only run when exemplar is provided. */
  voiceMatch?: number;
  /** Free-form rationale from the LLM judge. */
  rationale?: string;
  /** Hallucinations the judge flagged on top of deterministic checks. */
  hallucinations?: string[];
}

export interface CaseScore {
  caseId: string;
  category: GoldenCategory;
  deterministic: DeterministicScore;
  judged: JudgedScore;
  /** Weighted overall: 0.3*structure + 0.3*clauses + 0.3*voice + 0.1*hallucination */
  overall: number;
  /** A case "passes" when overall ≥ 0.8 AND hallucinationCheck === 'pass'. */
  passed: boolean;
  /** Truthy when the orchestrator threw. */
  error?: string;
  durationMs: number;
}

export interface EvalReport {
  /** ISO timestamp the run started. */
  startedAt: string;
  /** Total run duration in seconds. */
  durationSec: number;
  /** Eval suite version — bump when scoring math changes. */
  rubricVersion: string;
  totalCases: number;
  passed: number;
  failed: number;
  errored: number;
  /** Pass rate over non-errored cases. */
  passRate: number;
  /** Mean overall score across all non-errored cases. */
  meanOverall: number;
  byCategory: Record<
    GoldenCategory,
    {
      total: number;
      passed: number;
      passRate: number;
      meanOverall: number;
    }
  >;
  cases: CaseScore[];
}
