/**
 * WorkflowOrchestrator — Phase 3.5.
 *
 * Drives multi-turn questionnaires (TPRM, 90-Day Blueprint progress, future
 * audit workflows). Pure stateless engine: every method round-trips through
 * a `WorkflowStore`, which is Prisma in production and an in-memory map in
 * tests. Workflows are registered up-front; runtime selection is by string
 * key so new workflows are a one-line addition to the registry.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 3.5.2
 */

import { prisma } from '@/lib/prisma';
import type {
  RedFlag,
  WorkflowAnswer,
  WorkflowDefinition,
  WorkflowFinalizeOutput,
  WorkflowState,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepResult,
  WorkflowType,
} from '@/types/workflows';

// ─── Storage abstraction ────────────────────────────────────────────────────

/**
 * Storage backend the orchestrator delegates to. Production uses
 * `prismaWorkflowStore`; tests pass `createMemoryStore()`.
 */
export interface WorkflowStore {
  create(input: {
    userId: string;
    conversationId?: string;
    workflowType: WorkflowType;
    totalSteps: number;
    state: WorkflowState;
  }): Promise<{ id: string }>;
  load(sessionId: string, userId: string): Promise<{
    state: WorkflowState;
    status: WorkflowStatus;
    conversationId?: string | null;
  } | null>;
  save(
    sessionId: string,
    userId: string,
    state: WorkflowState,
    extra?: { status?: WorkflowStatus; artifactId?: string },
  ): Promise<void>;
}

/** Default Prisma-backed store — used by the API routes. */
export const prismaWorkflowStore: WorkflowStore = {
  async create({ userId, conversationId, workflowType, totalSteps, state }) {
    const session = await prisma.workflowSession.create({
      data: {
        userId,
        conversationId: conversationId ?? null,
        workflowType,
        totalSteps,
        currentStep: 0,
        status: state.status,
        state: JSON.stringify(state),
      },
    });
    return { id: session.id };
  },
  async load(sessionId, userId) {
    const row = await prisma.workflowSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row) return null;
    const state = JSON.parse(row.state) as WorkflowState;
    return { state, status: row.status as WorkflowStatus, conversationId: row.conversationId };
  },
  async save(sessionId, userId, state, extra) {
    await prisma.workflowSession.updateMany({
      where: { id: sessionId, userId },
      data: {
        state: JSON.stringify(state),
        currentStep: state.currentStep,
        status: extra?.status ?? state.status,
        ...(extra?.artifactId ? { artifactId: extra.artifactId } : {}),
      },
    });
  },
};

/** Test helper: in-memory store used by vitest. */
export function createMemoryStore(): WorkflowStore {
  const map = new Map<string, {
    userId: string;
    state: WorkflowState;
    status: WorkflowStatus;
    conversationId?: string;
    artifactId?: string;
  }>();
  let counter = 0;
  return {
    async create({ userId, conversationId, workflowType, state }) {
      const id = `mem_${++counter}_${workflowType}`;
      map.set(id, { userId, conversationId, state: { ...state, sessionId: id }, status: state.status });
      return { id };
    },
    async load(sessionId, userId) {
      const row = map.get(sessionId);
      if (!row || row.userId !== userId) return null;
      return { state: row.state, status: row.status, conversationId: row.conversationId };
    },
    async save(sessionId, userId, state, extra) {
      const row = map.get(sessionId);
      if (!row || row.userId !== userId) return;
      row.state = state;
      if (extra?.status) row.status = extra.status;
      if (extra?.artifactId) row.artifactId = extra.artifactId;
    },
  };
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export class WorkflowOrchestrator {
  private readonly registry = new Map<WorkflowType, WorkflowDefinition>();

  constructor(private readonly store: WorkflowStore = prismaWorkflowStore) {}

  /** Register a workflow definition before it can be started. */
  register(def: WorkflowDefinition): void {
    this.registry.set(def.type, def);
  }

  /** Look up the registered definition. Throws if not registered. */
  getDefinition(type: WorkflowType): WorkflowDefinition {
    const def = this.registry.get(type);
    if (!def) throw new Error(`[WorkflowOrchestrator] No workflow registered for type "${type}"`);
    return def;
  }

  /**
   * The workflow types currently registered on this orchestrator. The API
   * route uses this to validate the request body — the `WorkflowType` union
   * lists every theoretically-supported workflow, but only those that have
   * actually been `register()`-ed can be started without throwing.
   */
  registeredTypes(): WorkflowType[] {
    return [...this.registry.keys()];
  }

  /** True if a workflow type is registered and start-able. */
  isRegistered(type: string): type is WorkflowType {
    return this.registry.has(type as WorkflowType);
  }

  /** Begin a new session. Returns the sessionId + the first step. */
  async startSession(input: {
    userId: string;
    workflowType: WorkflowType;
    conversationId?: string;
    context?: Record<string, unknown>;
  }): Promise<{ sessionId: string; firstStep: WorkflowStep | null; state: WorkflowState }> {
    const def = this.getDefinition(input.workflowType);
    const seedState: WorkflowState = {
      // sessionId is patched after the row is created; we never persist this
      // empty string — the immediate `save()` below overwrites it with the
      // real DB id so future loads see the canonical sessionId.
      sessionId: '',
      workflowType: input.workflowType,
      status: 'in-progress',
      currentStep: 0,
      totalSteps: def.steps.length,
      answers: {},
      scores: {},
      redFlags: [],
      context: input.context ?? {},
    };
    const { id } = await this.store.create({
      userId: input.userId,
      conversationId: input.conversationId,
      workflowType: input.workflowType,
      totalSteps: def.steps.length,
      state: seedState,
    });
    const state: WorkflowState = { ...seedState, sessionId: id };
    // Re-save so the persisted record carries the real sessionId, not the
    // empty placeholder used at create() time.
    await this.store.save(id, input.userId, state);
    return { sessionId: id, firstStep: def.steps[0] ?? null, state };
  }

  /** Get the current step. */
  async getNextStep(sessionId: string, userId: string): Promise<WorkflowStep | null> {
    const loaded = await this.store.load(sessionId, userId);
    if (!loaded) return null;
    const def = this.getDefinition(loaded.state.workflowType);
    return def.steps[loaded.state.currentStep] ?? null;
  }

  /**
   * Submit an answer for the current step. Validates, scores, runs red-flag
   * check, advances the cursor, and persists. Returns the next step (or
   * `done: true` when there are no more).
   */
  async submitAnswer(
    sessionId: string,
    userId: string,
    sectionId: string,
    answer: unknown,
  ): Promise<WorkflowStepResult> {
    const loaded = await this.store.load(sessionId, userId);
    if (!loaded) throw new Error('[WorkflowOrchestrator] Session not found');
    const state = loaded.state;
    if (state.status !== 'in-progress') {
      throw new Error(`[WorkflowOrchestrator] Cannot submit to a ${state.status} session`);
    }

    const def = this.getDefinition(state.workflowType);
    const step = def.steps[state.currentStep];
    if (!step) throw new Error('[WorkflowOrchestrator] No current step — already at end');
    if (step.sectionId !== sectionId) {
      throw new Error(
        `[WorkflowOrchestrator] sectionId mismatch — expected ${step.sectionId}, got ${sectionId}`,
      );
    }

    let warning: string | undefined;
    if (step.validation) {
      const r = step.validation(answer);
      if (!r.ok) {
        // Hard-fail on validation: do NOT advance, return warning.
        return {
          state,
          nextStep: step,
          done: false,
          warning: r.message ?? 'Validation failed',
        };
      }
      if (r.message) warning = r.message;
    }

    const score = computeScore(step, answer);
    const ans: WorkflowAnswer = {
      value: answer,
      ...(score !== undefined ? { score } : {}),
      answeredAt: new Date().toISOString(),
    };
    state.answers[step.sectionId] = ans;
    if (score !== undefined) state.scores[step.sectionId] = score;

    if (step.redFlagCheck) {
      const flag = step.redFlagCheck(answer);
      if (flag) state.redFlags.push(flag);
    }

    state.currentStep += 1;
    const next = def.steps[state.currentStep] ?? null;
    const done = next === null;
    if (done) state.status = 'completed';

    await this.store.save(sessionId, userId, state, done ? { status: 'completed' } : undefined);

    return { state, nextStep: next, done, warning };
  }

  async pauseSession(sessionId: string, userId: string): Promise<void> {
    const loaded = await this.store.load(sessionId, userId);
    if (!loaded) throw new Error('[WorkflowOrchestrator] Session not found');
    if (loaded.state.status !== 'in-progress') return;
    loaded.state.status = 'paused';
    await this.store.save(sessionId, userId, loaded.state, { status: 'paused' });
  }

  async resumeSession(sessionId: string, userId: string): Promise<WorkflowState> {
    const loaded = await this.store.load(sessionId, userId);
    if (!loaded) throw new Error('[WorkflowOrchestrator] Session not found');
    if (loaded.state.status === 'completed' || loaded.state.status === 'abandoned') {
      throw new Error(`[WorkflowOrchestrator] Cannot resume ${loaded.state.status} session`);
    }
    loaded.state.status = 'in-progress';
    await this.store.save(sessionId, userId, loaded.state, { status: 'in-progress' });
    return loaded.state;
  }

  /** Build the final document. The session must already be `completed`. */
  async finalize(sessionId: string, userId: string): Promise<WorkflowFinalizeOutput> {
    const loaded = await this.store.load(sessionId, userId);
    if (!loaded) throw new Error('[WorkflowOrchestrator] Session not found');
    if (loaded.state.status !== 'completed' && loaded.state.currentStep < loaded.state.totalSteps) {
      throw new Error('[WorkflowOrchestrator] Cannot finalize an incomplete session');
    }
    const def = this.getDefinition(loaded.state.workflowType);
    return def.finalize(loaded.state);
  }

  /** Attach the persisted artifact to a completed workflow session. */
  async attachArtifact(sessionId: string, userId: string, artifactId: string): Promise<void> {
    const loaded = await this.store.load(sessionId, userId);
    if (!loaded) throw new Error('[WorkflowOrchestrator] Session not found');
    await this.store.save(sessionId, userId, loaded.state, { artifactId });
  }

  /** Snapshot the current state for the UI. */
  async getState(sessionId: string, userId: string): Promise<WorkflowState | null> {
    const loaded = await this.store.load(sessionId, userId);
    return loaded?.state ?? null;
  }

  /** Return the conversation linked to this workflow session, if any. */
  async getConversationId(sessionId: string, userId: string): Promise<string | undefined> {
    const loaded = await this.store.load(sessionId, userId);
    return loaded?.conversationId ?? undefined;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeScore(step: WorkflowStep, answer: unknown): number | undefined {
  if (!step.scoringRubric) return undefined;
  if (typeof answer === 'number') return answer;
  if (typeof answer === 'boolean') return answer ? 1 : 0;
  return undefined;
}

/** Aggregate helpers used by finalizers. */
export function aggregateScores(scores: Record<string, number>): { average: number | undefined; count: number } {
  const values = Object.values(scores);
  if (values.length === 0) return { average: undefined, count: 0 };
  const sum = values.reduce((acc, n) => acc + n, 0);
  return { average: Math.round((sum / values.length) * 100) / 100, count: values.length };
}

/** Reduce the red-flag list into a deduped, severity-ordered set. */
export function summarizeRedFlags(flags: RedFlag[]): RedFlag[] {
  const order: Record<RedFlag['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...flags].sort((a, b) => order[a.severity] - order[b.severity]);
}

// ─── Default singleton (with TPRM pre-registered) ─────────────────────────

import { TPRM_WORKFLOW } from './workflows/tprm';

export const workflowOrchestrator = new WorkflowOrchestrator();
workflowOrchestrator.register(TPRM_WORKFLOW);
