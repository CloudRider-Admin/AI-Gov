import { describe, it, expect } from 'vitest';
import {
  requiresApproval,
  riskSeverity,
  severityAtLeast,
  approvalValidityDays,
  isApprovalDecision,
  isEntityKind,
  GATE_SPECS,
  ENTITY_KINDS,
} from '../gateEnums';
import { evaluateGate1, evaluateGate2, evaluateGate3 } from '../gates';

describe('risk severity mapping', () => {
  it('maps the EU AI Act categories onto severity bands', () => {
    expect(riskSeverity('minimal')).toBe('low');
    expect(riskSeverity('limited')).toBe('medium');
    expect(riskSeverity('high')).toBe('high');
    expect(riskSeverity('prohibited')).toBe('critical');
  });

  it('defaults an unrecognized category to medium rather than waving it through', () => {
    expect(riskSeverity('something-else')).toBe('medium');
  });

  it('orders severities correctly', () => {
    expect(severityAtLeast('high', 'medium')).toBe(true);
    expect(severityAtLeast('medium', 'medium')).toBe(true);
    expect(severityAtLeast('low', 'medium')).toBe(false);
  });
});

describe('requiresApproval', () => {
  it('requires approval at medium risk and above', () => {
    expect(requiresApproval('limited')).toBe(true);
    expect(requiresApproval('high')).toBe(true);
    expect(requiresApproval('prohibited')).toBe(true);
  });

  it('does not require approval below medium risk', () => {
    expect(requiresApproval('minimal')).toBe(false);
  });
});

describe('approvalValidityDays', () => {
  it('shortens the leash as risk rises', () => {
    expect(approvalValidityDays('prohibited')).toBe(90);
    expect(approvalValidityDays('high')).toBe(180);
    expect(approvalValidityDays('limited')).toBe(365);
  });

  it('has no expiry where no approval was required', () => {
    expect(approvalValidityDays('minimal')).toBeNull();
  });
});

describe('guards', () => {
  it('accepts only real approval decisions', () => {
    expect(isApprovalDecision('approved')).toBe(true);
    expect(isApprovalDecision('rejected')).toBe(true);
    expect(isApprovalDecision('pending')).toBe(false);
    expect(isApprovalDecision('maybe')).toBe(false);
  });

  it('accepts only the three entity kinds', () => {
    for (const kind of ENTITY_KINDS) expect(isEntityKind(kind)).toBe(true);
    expect(isEntityKind('pipeline')).toBe(false);
  });
});

describe('GATE_SPECS', () => {
  it('defines all three gates with exit criteria', () => {
    for (const gate of [1, 2, 3] as const) {
      expect(GATE_SPECS[gate].name).toBeTruthy();
      expect(GATE_SPECS[gate].exitCriteria.length).toBeGreaterThan(0);
    }
  });
});

// ─── Gate evaluators (pure functions over already-loaded rows) ───────────────

const baseSystem = {
  id: 'sys_1',
  userId: 'user_1',
  organizationId: null,
  name: 'Support copilot',
  entityKind: 'use-case',
  purpose: 'Answer customer questions',
  businessOwner: 'A. Owner',
  riskCategory: 'limited',
  dataTypes: ['PII'],
  approvalStatus: 'pending',
  approvedByName: null,
  approvedAt: null,
};

describe('evaluateGate1', () => {
  it('passes a fully described entity', () => {
    const result = evaluateGate1(baseSystem);
    expect(result.status).toBe('passed');
    expect(result.blockers).toHaveLength(0);
  });

  it('blocks when no business owner is named', () => {
    const result = evaluateGate1({ ...baseSystem, businessOwner: null });
    expect(result.status).toBe('in-progress');
    expect(result.blockers.join(' ')).toContain('business owner');
  });

  it('blocks when no data types are declared', () => {
    const result = evaluateGate1({ ...baseSystem, dataTypes: [] });
    expect(result.status).toBe('in-progress');
    expect(result.blockers.join(' ')).toContain('data types');
  });

  it('treats whitespace as an empty owner', () => {
    const result = evaluateGate1({ ...baseSystem, businessOwner: '   ' });
    expect(result.status).toBe('in-progress');
  });
});

describe('evaluateGate2', () => {
  const reviewedRun = (verdict: string, reviewedAt: Date) => ({
    id: 'run_1',
    runLabel: 'eval-1',
    status: 'reviewed',
    overallVerdict: verdict,
    reviewedAt,
    coverageRatio: 0.8,
  });

  it('does not start before Gate 1 passes', () => {
    const result = evaluateGate2(baseSystem, [], false);
    expect(result.status).toBe('not-started');
    expect(result.blockers.join(' ')).toContain('Gate 1');
  });

  it('does not start with no evaluation runs', () => {
    const result = evaluateGate2(baseSystem, [], true);
    expect(result.status).toBe('not-started');
  });

  it('is in progress while evidence is ingested but unreviewed', () => {
    const result = evaluateGate2(
      baseSystem,
      [{ id: 'r', runLabel: 'eval-1', status: 'ingested', overallVerdict: null, reviewedAt: null, coverageRatio: null }],
      true,
    );
    expect(result.status).toBe('in-progress');
  });

  it('passes on a clean evidence report', () => {
    const result = evaluateGate2(baseSystem, [reviewedRun('pass', new Date())], true);
    expect(result.status).toBe('passed');
  });

  it('passes on a conditional pass, carrying remediation forward', () => {
    const result = evaluateGate2(baseSystem, [reviewedRun('conditional-pass', new Date())], true);
    expect(result.status).toBe('passed');
  });

  it('fails on a failing evidence report', () => {
    const result = evaluateGate2(baseSystem, [reviewedRun('fail', new Date())], true);
    expect(result.status).toBe('failed');
  });

  it('judges on the most recent review, not the most favourable', () => {
    const older = reviewedRun('pass', new Date('2026-01-01'));
    const newer = { ...reviewedRun('fail', new Date('2026-06-01')), id: 'run_2', runLabel: 'eval-2' };
    const result = evaluateGate2(baseSystem, [older, newer], true);
    expect(result.status).toBe('failed');
  });
});

describe('evaluateGate3', () => {
  it('passes without a decision below the approval threshold', () => {
    const result = evaluateGate3({ ...baseSystem, riskCategory: 'minimal' }, true, 0);
    expect(result.status).toBe('passed');
    expect(result.summary).toContain('No approval decision required');
  });

  it('holds while remediation is open, even with Gate 2 passed', () => {
    const result = evaluateGate3(baseSystem, true, 3);
    expect(result.status).toBe('not-started');
    expect(result.blockers.join(' ')).toContain('remediation');
  });

  it('holds while Gate 2 has not passed', () => {
    const result = evaluateGate3(baseSystem, false, 0);
    expect(result.status).toBe('not-started');
    expect(result.blockers.join(' ')).toContain('Gate 2');
  });

  it('becomes eligible once evidence is clear and remediation is closed', () => {
    const result = evaluateGate3(baseSystem, true, 0);
    expect(result.status).toBe('in-progress');
    expect(result.blockers).toHaveLength(0);
  });

  it('passes once approved', () => {
    const result = evaluateGate3(
      { ...baseSystem, approvalStatus: 'approved', approvedByName: 'R. Approver', approvedAt: new Date('2026-07-30') },
      true,
      0,
    );
    expect(result.status).toBe('passed');
    expect(result.summary).toContain('R. Approver');
  });

  it('fails once rejected', () => {
    const result = evaluateGate3({ ...baseSystem, approvalStatus: 'rejected' }, true, 0);
    expect(result.status).toBe('failed');
  });
});
