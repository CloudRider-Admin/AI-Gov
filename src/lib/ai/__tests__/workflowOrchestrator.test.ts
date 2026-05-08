import { describe, expect, it } from 'vitest';

import {
  createMemoryStore,
  WorkflowOrchestrator,
  aggregateScores,
  summarizeRedFlags,
} from '../workflowOrchestrator';
import { TPRM_WORKFLOW } from '../workflows/tprm';
import type { RedFlag, WorkflowDefinition, WorkflowState } from '@/types/workflows';

const USER = 'user_test';

function buildOrchestrator(def: WorkflowDefinition = TPRM_WORKFLOW): WorkflowOrchestrator {
  const o = new WorkflowOrchestrator(createMemoryStore());
  o.register(def);
  return o;
}

describe('WorkflowOrchestrator', () => {
  it('refuses to start a workflow that is not registered', async () => {
    const o = new WorkflowOrchestrator(createMemoryStore());
    await expect(
      o.startSession({ userId: USER, workflowType: 'tprm' }),
    ).rejects.toThrow(/No workflow registered/);
  });

  it('registers TPRM and returns the first step on start', async () => {
    const o = buildOrchestrator();
    const { sessionId, firstStep, state } = await o.startSession({
      userId: USER,
      workflowType: 'tprm',
      context: { vendorName: 'Acme AI' },
    });
    expect(sessionId).toBeTruthy();
    expect(firstStep).not.toBeNull();
    expect(firstStep!.responseType).toBe('score');
    expect(state.totalSteps).toBe(TPRM_WORKFLOW.steps.length);
    expect(state.currentStep).toBe(0);
    expect(state.context.vendorName).toBe('Acme AI');
  });

  it('rejects an out-of-range maturity score', async () => {
    const o = buildOrchestrator();
    const { sessionId, firstStep } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    const r = await o.submitAnswer(sessionId, USER, firstStep!.sectionId, 7);
    expect(r.warning).toMatch(/integer between 1 and 5/);
    expect(r.state.currentStep).toBe(0); // did NOT advance
  });

  it('advances after a valid answer and records the score', async () => {
    const o = buildOrchestrator();
    const { sessionId, firstStep } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    const r = await o.submitAnswer(sessionId, USER, firstStep!.sectionId, 4);
    expect(r.warning).toBeUndefined();
    expect(r.state.currentStep).toBe(1);
    expect(r.state.scores[firstStep!.sectionId]).toBe(4);
    expect(r.nextStep).not.toBeNull();
  });

  it('fires a red-flag for required-section maturity below threshold', async () => {
    const o = buildOrchestrator();
    const { sessionId, firstStep } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    // First TPRM step is "1) AI System Overview" which is Required.
    const r = await o.submitAnswer(sessionId, USER, firstStep!.sectionId, 2);
    expect(r.state.redFlags.length).toBe(1);
    expect(r.state.redFlags[0].severity).toBe('high');
  });

  it('reports done=true after the final step and switches status to completed', async () => {
    const o = buildOrchestrator();
    const { sessionId } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    let nextStep: { sectionId: string } | null = TPRM_WORKFLOW.steps[0];
    let last: Awaited<ReturnType<typeof o.submitAnswer>> | undefined;
    for (let i = 0; i < TPRM_WORKFLOW.steps.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await o.submitAnswer(sessionId, USER, nextStep!.sectionId, 4);
      nextStep = r.nextStep;
      last = r;
    }
    expect(last?.done).toBe(true);
    expect(last?.state.status).toBe('completed');
  });

  it('pauses and resumes a session', async () => {
    const o = buildOrchestrator();
    const { sessionId } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    await o.pauseSession(sessionId, USER);
    const stateAfterPause = await o.getState(sessionId, USER);
    expect(stateAfterPause?.status).toBe('paused');
    const resumed = await o.resumeSession(sessionId, USER);
    expect(resumed.status).toBe('in-progress');
  });

  it('finalize produces a GovernanceDocumentOutput with executive summary + sections + decision', async () => {
    const o = buildOrchestrator();
    const { sessionId } = await o.startSession({
      userId: USER,
      workflowType: 'tprm',
      context: { vendorName: 'Acme AI', riskTier: 'High' },
    });
    let nextStep: { sectionId: string } | null = TPRM_WORKFLOW.steps[0];
    for (let i = 0; i < TPRM_WORKFLOW.steps.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await o.submitAnswer(sessionId, USER, nextStep!.sectionId, 4);
      nextStep = r.nextStep;
    }
    const final = await o.finalize(sessionId, USER);
    expect(final.document.documentType).toBe('govsecure-tprm');
    expect(final.document.title).toContain('Acme AI');
    expect(final.document.sections[0].heading).toBe('Executive Summary');
    expect(final.document.sections.at(-1)?.heading).toBe('Recommended Decision');
    expect(final.document.markdownExport).toContain('# TPRM Assessment — Acme AI');
    expect(final.summary.answered).toBe(TPRM_WORKFLOW.steps.length);
    expect(final.summary.averageScore).toBe(4);
  });

  it('refuses to finalize an incomplete session', async () => {
    const o = buildOrchestrator();
    const { sessionId } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    await expect(o.finalize(sessionId, USER)).rejects.toThrow(/incomplete/);
  });

  it('sessions are scoped to the owning user', async () => {
    const o = buildOrchestrator();
    const { sessionId } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    const stateForOther = await o.getState(sessionId, 'someone_else');
    expect(stateForOther).toBeNull();
  });
});

describe('helpers', () => {
  it('aggregateScores returns the average rounded to 2dp', () => {
    expect(aggregateScores({ a: 4, b: 5, c: 3 })).toEqual({ average: 4, count: 3 });
    expect(aggregateScores({})).toEqual({ average: undefined, count: 0 });
  });

  it('summarizeRedFlags orders by severity (critical first)', () => {
    const flags: RedFlag[] = [
      { sectionId: 'a', label: 'A', severity: 'low', reason: '' },
      { sectionId: 'b', label: 'B', severity: 'critical', reason: '' },
      { sectionId: 'c', label: 'C', severity: 'medium', reason: '' },
    ];
    const sorted = summarizeRedFlags(flags);
    expect(sorted.map((f) => f.severity)).toEqual(['critical', 'medium', 'low']);
  });
});

describe('TPRM_WORKFLOW shape', () => {
  it('every step has scoring rubric, validation, and red-flag check', () => {
    expect(TPRM_WORKFLOW.steps.length).toBeGreaterThanOrEqual(9);
    for (const s of TPRM_WORKFLOW.steps) {
      expect(s.responseType).toBe('score');
      expect(s.scoringRubric).toBeDefined();
      expect(s.validation).toBeDefined();
      expect(s.redFlagCheck).toBeDefined();
    }
  });

  it('rubric uses a 1-5 scale with anchors', () => {
    const rubric = TPRM_WORKFLOW.steps[0].scoringRubric;
    expect(rubric?.scale).toMatch(/1.{0,2}5/);
    expect(rubric?.anchors?.[1]).toBeTruthy();
    expect(rubric?.anchors?.[5]).toBeTruthy();
  });
});

describe('getNextStep when at end', () => {
  it('returns null after the final step has been answered', async () => {
    const o = buildOrchestrator();
    const { sessionId } = await o.startSession({ userId: USER, workflowType: 'tprm' });
    let nextStep: { sectionId: string } | null = TPRM_WORKFLOW.steps[0];
    for (let i = 0; i < TPRM_WORKFLOW.steps.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await o.submitAnswer(sessionId, USER, nextStep!.sectionId, 4);
      nextStep = r.nextStep;
    }
    const after = await o.getNextStep(sessionId, USER);
    expect(after).toBeNull();
  });
});

describe('createMemoryStore (state container shape)', () => {
  it('stores and reads back a stable state object', async () => {
    const store = createMemoryStore();
    const initial: WorkflowState = {
      sessionId: '',
      workflowType: 'tprm',
      status: 'in-progress',
      currentStep: 0,
      totalSteps: 1,
      answers: {},
      scores: {},
      redFlags: [],
      context: {},
    };
    const { id } = await store.create({ userId: USER, workflowType: 'tprm', totalSteps: 1, state: initial });
    const loaded = await store.load(id, USER);
    expect(loaded?.state.workflowType).toBe('tprm');
    expect(loaded?.state.status).toBe('in-progress');
  });
});
