/** Serializable shapes handed from the gate server components to the client. */

export interface GateSystemView {
  id: string;
  name: string;
  entityKind: string;
  purpose: string | null;
  businessOwner: string | null;
  vendor: string | null;
  riskCategory: string;
  lifecycleStage: string;
  dataTypes: string[];
  approvalStatus: string;
  approvedByName: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  approvalExpiresAt: string | null;
}

export interface GateRecordView {
  gate: number;
  status: string;
  summary: string | null;
  blockers: string[];
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface EvaluationResultView {
  id: string;
  area: string;
  parameter: string;
  metricValue: number | null;
  unit: string | null;
  textValue: string | null;
  sampleSize: number | null;
  verdict: string;
  severity: string;
  baselineNote: string | null;
  gap: string | null;
}

export interface EvaluationRunView {
  id: string;
  runLabel: string;
  source: string;
  evaluatorTeam: string | null;
  evaluatorName: string | null;
  platform: string | null;
  status: string;
  overallVerdict: string | null;
  reviewSummary: string | null;
  reportMarkdown: string | null;
  coverageRatio: number | null;
  evaluatedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  results: EvaluationResultView[];
}

export interface ApprovalEligibilityView {
  required: boolean;
  eligible: boolean;
  reasons: string[];
  openRemediation: number;
  gate2Passed: boolean;
}

export interface OpenTaskView {
  id: string;
  title: string;
  priority: string;
  status: string;
}
