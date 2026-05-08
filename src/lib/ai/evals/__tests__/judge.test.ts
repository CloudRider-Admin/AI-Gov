import { beforeEach, describe, expect, it } from 'vitest';

import { judgeOutput } from '../judge';
import type { AdvisoryGolden } from '../types';

const ADVISORY_CASE: AdvisoryGolden = {
  id: 'judge-test',
  category: 'advisory-query',
  input: { message: 'how do AI risk tiers work?' },
  requiredClauses: ['Low', 'High'],
  forbiddenContent: [],
};

describe('judge.ts (mock fallback)', () => {
  beforeEach(() => {
    // NODE_ENV=test forces mock. Be explicit so the test does not depend on env.
    process.env.EVAL_MOCK = '1';
  });

  it('returns a deterministic voiceMatch derived from required-clause coverage', async () => {
    const judged = await judgeOutput({
      goldenCase: ADVISORY_CASE,
      generatedText: 'Risk tiers run from Low to High in the GovSecure model.',
    });
    expect(judged.voiceMatch).toBe(1);
    expect(judged.rationale).toContain('mock-judge');
    expect(judged.hallucinations).toEqual([]);
  });

  it('returns 0 voiceMatch when no required clauses are present', async () => {
    const judged = await judgeOutput({
      goldenCase: ADVISORY_CASE,
      generatedText: 'Completely unrelated text.',
    });
    expect(judged.voiceMatch).toBe(0);
  });

  it('handles cases with no required clauses by returning 1', async () => {
    const judged = await judgeOutput({
      goldenCase: { ...ADVISORY_CASE, requiredClauses: [] },
      generatedText: 'anything',
    });
    expect(judged.voiceMatch).toBe(1);
  });
});
