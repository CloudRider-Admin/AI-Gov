/**
 * The gate state machine's integrity rules.
 *
 * The pure evaluators are also exercised in gateEnums.test.ts, which covers the
 * happy paths. This file covers the cases where a gate must REFUSE to pass —
 * the ones an auditor pushes on, and the ones a regression would quietly undo.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateGate2,
  evaluateGate3,
  waiverHasLapsed,
  WAIVER_VALIDITY_DAYS,
  type LegacyEvidenceSummary,
} from '../gates';

const baseSystem = {
  id: 'sys_1',
  userId: 'user_1',
  organizationId: null,
  name: 'Support copilot',
  entityKind: 'use-case',
  purpose: 'Answer customer questions',
  businessOwner: 'A. Owner',
  riskCategory: 'moderate',
  dataTypes: ['PII'],
  approvalStatus: 'pending',
  approvedByName: null,
  approvedAt: null,
};

const approved = {
  ...baseSystem,
  approvalStatus: 'approved',
  approvedByName: 'R. Approver',
  approvedAt: new Date('2026-07-30'),
};

const reviewedRun = (verdict: string, reviewedAt: Date, label = 'eval-1') => ({
  id: `run_${label}`,
  runLabel: label,
  status: 'reviewed',
  overallVerdict: verdict,
  reviewedAt,
  coverageRatio: 0.8,
});

const noLegacy: LegacyEvidenceSummary = { reports: [], evidenceCount: 0 };

// ─── Gate 3 — an approval must never outrank the evidence ────────────────────

describe('evaluateGate3 — an approval on record does not bypass the exit criteria', () => {
  it('does not pass when Gate 2 has not passed, even though an approval is recorded', () => {
    const result = evaluateGate3(approved, false, 0);
    expect(result.status).not.toBe('passed');
    expect(result.status).toBe('failed');
    expect(result.blockers.join(' ')).toContain('Gate 2');
  });

  it('does not pass while remediation is open, even though an approval is recorded', () => {
    const result = evaluateGate3(approved, true, 2);
    expect(result.status).not.toBe('passed');
    expect(result.status).toBe('failed');
    expect(result.blockers.join(' ')).toContain('remediation');
  });

  it('names the stale approval rather than silently withholding the pass', () => {
    const result = evaluateGate3(approved, false, 3);
    expect(result.summary).toContain('no longer holds');
    expect(result.summary).toContain('R. Approver');
    expect(result.blockers.join(' ')).toContain('stale');
    // Both regressions are reported, not just the first one found.
    expect(result.blockers.join(' ')).toContain('Gate 2');
    expect(result.blockers.join(' ')).toContain('remediation');
  });

  it('still passes when the approval rests on criteria that hold', () => {
    const result = evaluateGate3(approved, true, 0);
    expect(result.status).toBe('passed');
    expect(result.summary).toContain('R. Approver');
  });

  it('lets a rejection stand even while the criteria are unmet', () => {
    const rejected = { ...baseSystem, approvalStatus: 'rejected', approvedByName: 'R. Approver' };
    const result = evaluateGate3(rejected, false, 5);
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('Rejected');
  });

  it('ignores an approval status below the approval threshold', () => {
    // A low-risk entity needs no decision; a stray 'approved' must not change that.
    const result = evaluateGate3({ ...approved, riskCategory: 'low' }, false, 4);
    expect(result.status).toBe('passed');
    expect(result.summary).toContain('No approval decision required');
  });
});

// ─── Gate 2 — both evidence paths move the gate ──────────────────────────────

describe('evaluateGate2 — legacy inventory-drawer evidence is not a side channel', () => {
  it('moves off not-started when only hand-entered evidence exists', () => {
    const result = evaluateGate2(baseSystem, [], true, { reports: [], evidenceCount: 3 });
    expect(result.status).toBe('in-progress');
    expect(result.blockers.join(' ')).toContain('evidence report');
  });

  it('passes on a clean legacy evidence report with no evaluation runs', () => {
    const result = evaluateGate2(baseSystem, [], true, {
      reports: [{ id: 'rep_1', verdict: 'pass', createdAt: new Date('2026-07-01') }],
      evidenceCount: 4,
    });
    expect(result.status).toBe('passed');
  });

  it('fails on a failing legacy evidence report', () => {
    const result = evaluateGate2(baseSystem, [], true, {
      reports: [{ id: 'rep_1', verdict: 'fail', createdAt: new Date('2026-07-01') }],
      evidenceCount: 4,
    });
    expect(result.status).toBe('failed');
  });

  it('judges on the most recent verdict across both paths, not the friendlier one', () => {
    // A drawer report says pass; a later scored run says fail. The run wins.
    const result = evaluateGate2(
      baseSystem,
      [reviewedRun('fail', new Date('2026-07-15'), 'eval-2')],
      true,
      { reports: [{ id: 'rep_1', verdict: 'pass', createdAt: new Date('2026-07-01') }], evidenceCount: 2 },
    );
    expect(result.status).toBe('failed');
  });

  it('lets a later legacy report supersede an earlier failing run', () => {
    const result = evaluateGate2(
      baseSystem,
      [reviewedRun('fail', new Date('2026-06-01'), 'eval-1')],
      true,
      { reports: [{ id: 'rep_1', verdict: 'pass', createdAt: new Date('2026-07-01') }], evidenceCount: 2 },
    );
    expect(result.status).toBe('passed');
  });

  it('still refuses to start before Gate 1, whatever evidence exists', () => {
    const result = evaluateGate2(baseSystem, [reviewedRun('pass', new Date())], false, {
      reports: [{ id: 'rep_1', verdict: 'pass', createdAt: new Date() }],
      evidenceCount: 9,
    });
    expect(result.status).toBe('not-started');
    expect(result.blockers.join(' ')).toContain('Gate 1');
  });

  it('reports not-started only when neither path holds any evidence', () => {
    const result = evaluateGate2(baseSystem, [], true, noLegacy);
    expect(result.status).toBe('not-started');
  });
});

// ─── Waivers expire ──────────────────────────────────────────────────────────

describe('waiverHasLapsed — a waiver cannot silence a gate forever', () => {
  const now = new Date('2026-08-09T12:00:00Z');

  it('stands while inside its validity window', () => {
    const record = { status: 'waived', waiverExpiresAt: new Date('2026-09-01') };
    expect(waiverHasLapsed(record, now)).toBe(false);
  });

  it('lapses once the expiry has passed', () => {
    const record = { status: 'waived', waiverExpiresAt: new Date('2026-07-01') };
    expect(waiverHasLapsed(record, now)).toBe(true);
  });

  it('never applies to a gate that is not waived', () => {
    const record = { status: 'passed', waiverExpiresAt: new Date('2026-01-01') };
    expect(waiverHasLapsed(record, now)).toBe(false);
  });

  it('leaves a pre-expiry waiver standing rather than reopening it on deploy', () => {
    // Rows written before waivers had expiries; the migration backfills them,
    // and until it runs they must not all lapse at once.
    const record = { status: 'waived', waiverExpiresAt: null };
    expect(waiverHasLapsed(record, now)).toBe(false);
  });

  it('gives a fresh waiver a bounded life', () => {
    expect(WAIVER_VALIDITY_DAYS).toBeGreaterThan(0);
    const granted = new Date('2026-08-09T12:00:00Z');
    const expires = new Date(granted.getTime() + WAIVER_VALIDITY_DAYS * 86_400_000);
    expect(waiverHasLapsed({ status: 'waived', waiverExpiresAt: expires }, granted)).toBe(false);
    expect(
      waiverHasLapsed(
        { status: 'waived', waiverExpiresAt: expires },
        new Date(expires.getTime() + 1000),
      ),
    ).toBe(true);
  });
});
