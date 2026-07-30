import { describe, it, expect } from 'vitest';
import { scoreResult, scoreRun, describeBaseline, type ScoringContext } from '../baselineScoring';
import { getAreaSpec } from '../coreEvaluationParameters';

const mediumRiskUseCase: ScoringContext = { riskCategory: 'limited', entityKind: 'use-case' };
const highRiskUseCase: ScoringContext = { riskCategory: 'high', entityKind: 'use-case' };
const lowRiskUseCase: ScoringContext = { riskCategory: 'minimal', entityKind: 'use-case' };
const mediumRiskAgent: ScoringContext = { riskCategory: 'limited', entityKind: 'agent' };

describe('scoreResult — numeric thresholds', () => {
  it('passes a business effectiveness result at the 90% baseline', () => {
    const result = scoreResult(
      { area: 'business-effectiveness', parameter: 'task completion', metricValue: 90, unit: 'percent' },
      mediumRiskUseCase,
    );
    expect(result.verdict).toBe('pass');
    expect(result.gap).toBeNull();
  });

  it('fails a business effectiveness result below the baseline', () => {
    const result = scoreResult(
      { area: 'business-effectiveness', parameter: 'task completion', metricValue: 82, unit: 'percent' },
      mediumRiskUseCase,
    );
    expect(result.verdict).toBe('fail');
    expect(result.gap).toContain('82%');
  });

  it('normalizes a ratio onto a percent baseline', () => {
    // 0.96 groundedness must be read as 96%, not as 0.96% against a 95% bar.
    const result = scoreResult(
      { area: 'factual-reliability', parameter: 'groundedness', metricValue: 0.96, unit: 'ratio' },
      mediumRiskUseCase,
    );
    expect(result.verdict).toBe('pass');
  });

  it('infers a ratio from a bare 0–1 value against a percent baseline', () => {
    const result = scoreResult(
      { area: 'factual-reliability', parameter: 'groundedness', metricValue: 0.91 },
      mediumRiskUseCase,
    );
    expect(result.verdict).toBe('fail');
    expect(result.gap).toContain('91%');
  });

  it('applies a lte comparator to safety violation counts', () => {
    const clean = scoreResult(
      { area: 'safety', parameter: 'severe violations', metricValue: 0, unit: 'count' },
      mediumRiskUseCase,
    );
    expect(clean.verdict).toBe('pass');

    const breached = scoreResult(
      { area: 'safety', parameter: 'severe violations', metricValue: 2, unit: 'count' },
      mediumRiskUseCase,
    );
    expect(breached.verdict).toBe('fail');
    // Safety, security, and privacy breaches are never merely "medium".
    expect(breached.severity).toBe('critical');
  });

  it('scales severity with how far a soft area misses its baseline', () => {
    const nearMiss = scoreResult(
      { area: 'response-quality', parameter: 'average rating', metricValue: 3.95, unit: 'score-5' },
      mediumRiskUseCase,
    );
    expect(nearMiss.severity).toBe('low');

    const wideMiss = scoreResult(
      { area: 'response-quality', parameter: 'average rating', metricValue: 2.1, unit: 'score-5' },
      mediumRiskUseCase,
    );
    expect(wideMiss.severity).toBe('high');
  });
});

describe('scoreResult — qualitative areas', () => {
  it('reads a clearly negative observation as a failure', () => {
    const result = scoreResult(
      {
        area: 'agent-behavior',
        parameter: 'permission boundaries',
        textValue: 'Agent invoked an unapproved tool; permission boundary was breached.',
      },
      mediumRiskAgent,
    );
    expect(result.verdict).toBe('fail');
  });

  it('reads a clearly positive observation as a pass', () => {
    const result = scoreResult(
      {
        area: 'human-oversight',
        parameter: 'escalation',
        textValue: 'Escalation path tested and met in all sampled cases.',
      },
      mediumRiskUseCase,
    );
    expect(result.verdict).toBe('pass');
  });

  it('treats ambiguous prose as partial rather than a pass', () => {
    const result = scoreResult(
      { area: 'robustness', parameter: 'adversarial prompts', textValue: 'Some variance observed.' },
      highRiskUseCase,
    );
    expect(result.verdict).toBe('partial');
  });

  it('marks an empty result as not-assessed', () => {
    const result = scoreResult(
      { area: 'privacy', parameter: 'PII exposure' },
      mediumRiskUseCase,
    );
    expect(result.verdict).toBe('not-assessed');
    expect(result.gap).toContain('No measured value');
  });

  it('does not assess an area with no defined baseline', () => {
    const result = scoreResult(
      { area: 'not-a-real-area', parameter: 'whatever', metricValue: 100 },
      mediumRiskUseCase,
    );
    expect(result.verdict).toBe('not-assessed');
  });
});

describe('scoreRun — overall verdict', () => {
  /** Enough evidence to satisfy every area that is mandatory at medium risk. */
  const passingMediumEvidence = [
    { area: 'business-effectiveness', parameter: 'task completion', metricValue: 94, unit: 'percent' },
    { area: 'response-quality', parameter: 'average rating', metricValue: 4.4, unit: 'score-5' },
    { area: 'factual-reliability', parameter: 'groundedness', metricValue: 97, unit: 'percent' },
    { area: 'safety', parameter: 'severe violations', metricValue: 0, unit: 'count' },
    { area: 'security', parameter: 'critical attack success', metricValue: 0, unit: 'count' },
    { area: 'privacy', parameter: 'prohibited disclosures', metricValue: 0, unit: 'count' },
    { area: 'human-oversight', parameter: 'escalation', textValue: 'Escalation met in all sampled cases.' },
  ];

  it('passes when every mandatory area carries evidence that meets its baseline', () => {
    const score = scoreRun(passingMediumEvidence, mediumRiskUseCase);
    expect(score.verdict).toBe('pass');
    expect(score.missingAreas).toHaveLength(0);
    expect(score.blockers).toHaveLength(0);
  });

  it('fails when a mandatory area carries no evidence at all', () => {
    const withoutSafety = passingMediumEvidence.filter((r) => r.area !== 'safety');
    const score = scoreRun(withoutSafety, mediumRiskUseCase);
    expect(score.verdict).toBe('fail');
    expect(score.missingAreas).toContain('safety');
    expect(score.blockers.some((b) => b.includes('Safety'))).toBe(true);
  });

  it('fails outright on a security breach, never a conditional pass', () => {
    const breached = passingMediumEvidence.map((r) =>
      r.area === 'security' ? { ...r, metricValue: 3 } : r,
    );
    const score = scoreRun(breached, mediumRiskUseCase);
    expect(score.verdict).toBe('fail');
    expect(score.peakSeverity).toBe('critical');
  });

  it('degrades to a conditional pass on a soft near-miss', () => {
    const softMiss = passingMediumEvidence.map((r) =>
      r.area === 'business-effectiveness' ? { ...r, metricValue: 89 } : r,
    );
    const score = scoreRun(softMiss, mediumRiskUseCase);
    expect(score.verdict).toBe('conditional-pass');
  });

  it('reports an empty run as a failure rather than a vacuous pass', () => {
    const score = scoreRun([], mediumRiskUseCase);
    expect(score.verdict).toBe('fail');
    expect(score.coverageRatio).toBe(0);
  });

  it('does not require high-risk-only areas at medium risk', () => {
    // Fairness is mandatory from high severity; a medium-risk entity without it
    // must not be blocked on that ground.
    const score = scoreRun(passingMediumEvidence, mediumRiskUseCase);
    expect(score.missingAreas).not.toContain('fairness');
  });

  it('requires fairness and robustness at high risk', () => {
    const score = scoreRun(passingMediumEvidence, highRiskUseCase);
    expect(score.missingAreas).toContain('fairness');
    expect(score.missingAreas).toContain('robustness');
    expect(score.verdict).toBe('fail');
  });

  it('requires agent behavior evidence for an agent regardless of its tier', () => {
    const score = scoreRun(passingMediumEvidence, mediumRiskAgent);
    expect(score.missingAreas).toContain('agent-behavior');
  });

  it('does not require agent behavior evidence for a non-agent at the same tier', () => {
    const score = scoreRun(passingMediumEvidence, mediumRiskUseCase);
    expect(score.missingAreas).not.toContain('agent-behavior');
  });

  it('holds a thinly-evidenced low-risk run to a conditional pass on coverage', () => {
    const thin = [
      { area: 'business-effectiveness', parameter: 'task completion', metricValue: 95, unit: 'percent' },
    ];
    const score = scoreRun(thin, lowRiskUseCase);
    expect(score.missingAreas).toHaveLength(0);
    expect(score.verdict).toBe('conditional-pass');
  });

  it('computes coverage over all twelve core areas', () => {
    const score = scoreRun(passingMediumEvidence, mediumRiskUseCase);
    expect(score.coverageRatio).toBeCloseTo(7 / 12, 5);
  });
});

describe('baseline overrides', () => {
  it('honours a stricter org threshold over the code default', () => {
    const strict: ScoringContext = {
      ...mediumRiskUseCase,
      overrides: {
        'business-effectiveness': {
          expectation: 'At least 98% successful completion.',
          comparator: 'gte',
          threshold: 98,
          unit: 'percent',
        },
      },
    };
    const result = scoreResult(
      { area: 'business-effectiveness', parameter: 'task completion', metricValue: 94, unit: 'percent' },
      strict,
    );
    expect(result.verdict).toBe('fail');
    expect(result.baselineNote).toContain('98');
  });
});

describe('describeBaseline', () => {
  it('renders a numeric threshold alongside the expectation', () => {
    const spec = getAreaSpec('factual-reliability')!;
    expect(describeBaseline(spec.baseline)).toContain('≥ 95%');
  });

  it('renders a qualitative baseline as prose with no threshold', () => {
    const spec = getAreaSpec('fairness')!;
    const described = describeBaseline(spec.baseline);
    expect(described).toBe(spec.baseline.expectation);
    expect(described).not.toContain('threshold');
  });
});
