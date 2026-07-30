/**
 * Shared presentation tokens for the gate views.
 *
 * Kept in one module so the inventory table, the gate board, and the gate
 * detail page never drift on what "failed" or "conditional pass" looks like.
 * Colors come from the semantic tokens in DESIGN_SYSTEM.md — no new shades.
 */

export const GATE_STATUS_STYLES: Record<string, string> = {
  'not-started': 'bg-terminal-muted/15 text-terminal-muted border-terminal-border',
  'in-progress': 'bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40',
  passed: 'bg-terminal-green/15 text-terminal-green border-terminal-green/40',
  failed: 'bg-terminal-red/15 text-terminal-red border-terminal-red/40',
  waived: 'bg-terminal-cyan/15 text-terminal-cyan border-terminal-cyan/40',
};

export const GATE_STATUS_LABELS: Record<string, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  passed: 'Passed',
  failed: 'Failed',
  waived: 'Waived',
};

export const APPROVAL_STYLES: Record<string, string> = {
  'not-required': 'bg-terminal-muted/10 text-terminal-muted border-terminal-border',
  pending: 'bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40',
  approved: 'bg-terminal-green/15 text-terminal-green border-terminal-green/40',
  rejected: 'bg-terminal-red/15 text-terminal-red border-terminal-red/40',
};

export const APPROVAL_LABELS: Record<string, string> = {
  'not-required': 'Not required',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const RISK_STYLES: Record<string, string> = {
  prohibited: 'bg-terminal-red/15 text-terminal-red border-terminal-red/40',
  high: 'bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40',
  limited: 'bg-terminal-green/15 text-terminal-green border-terminal-green/40',
  minimal: 'bg-terminal-muted/15 text-terminal-muted border-terminal-border',
};

export const VERDICT_STYLES: Record<string, string> = {
  pass: 'bg-terminal-green/15 text-terminal-green border-terminal-green/40',
  'conditional-pass': 'bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40',
  fail: 'bg-terminal-red/15 text-terminal-red border-terminal-red/40',
  partial: 'bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40',
  'not-assessed': 'bg-terminal-muted/15 text-terminal-muted border-terminal-border',
};

export const VERDICT_LABELS: Record<string, string> = {
  pass: 'Pass',
  'conditional-pass': 'Conditional pass',
  fail: 'Fail',
  partial: 'Partial',
  'not-assessed': 'Not assessed',
};

export const SEVERITY_STYLES: Record<string, string> = {
  none: 'text-terminal-muted',
  low: 'text-terminal-muted',
  medium: 'text-terminal-amber',
  high: 'text-terminal-amber',
  critical: 'text-terminal-red',
};

export const STAGE_LABELS: Record<string, string> = {
  idea: 'Idea',
  piloting: 'Piloting',
  production: 'Production',
  retired: 'Retired',
};

export const EVALUATOR_TEAM_LABELS: Record<string, string> = {
  'data-science': 'Data science',
  engineering: 'Engineering',
  'red-team': 'Red team',
  vendor: 'Vendor',
  other: 'Other',
};
