import { describe, it, expect } from 'vitest';
import {
  parseMetric,
  parseCsv,
  parseCsvEvidence,
  parseJsonEvidence,
  parseMarkdownEvidence,
  parseEvidenceFile,
  normalizeRow,
} from '../evidenceIngestion';
import { resolveArea } from '../coreEvaluationParameters';

describe('parseMetric', () => {
  it('reads a plain number', () => {
    expect(parseMetric(93)).toEqual({ value: 93, impliedUnit: null });
  });

  it('reads a percentage string and infers the unit', () => {
    expect(parseMetric('93%')).toEqual({ value: 93, impliedUnit: 'percent' });
  });

  it('reads an out-of-five rating and infers the unit', () => {
    expect(parseMetric('4.2 / 5')).toEqual({ value: 4.2, impliedUnit: 'score-5' });
  });

  it('reads a millisecond latency', () => {
    expect(parseMetric('850ms')).toEqual({ value: 850, impliedUnit: 'ms' });
  });

  it('strips thousands separators', () => {
    expect(parseMetric('1,024')).toEqual({ value: 1024, impliedUnit: null });
  });

  it('maps pass/fail strings onto a failure count', () => {
    expect(parseMetric('pass')).toEqual({ value: 0, impliedUnit: 'count' });
    expect(parseMetric('FAILED')).toEqual({ value: 1, impliedUnit: 'count' });
  });

  it('returns null for prose', () => {
    expect(parseMetric('mostly fine, some variance').value).toBeNull();
  });

  it('rejects non-finite numbers', () => {
    expect(parseMetric(Number.NaN).value).toBeNull();
    expect(parseMetric(Number.POSITIVE_INFINITY).value).toBeNull();
  });
});

describe('resolveArea', () => {
  it('matches an exact area id', () => {
    expect(resolveArea('factual-reliability')).toBe('factual-reliability');
  });

  it('is insensitive to case and separators', () => {
    expect(resolveArea('Factual Reliability')).toBe('factual-reliability');
    expect(resolveArea('factual_reliability')).toBe('factual-reliability');
    expect(resolveArea('FACTUALRELIABILITY')).toBe('factual-reliability');
  });

  it('maps common eval vocabulary onto core areas', () => {
    expect(resolveArea('hallucination rate')).toBe('factual-reliability');
    expect(resolveArea('jailbreak')).toBe('security');
    expect(resolveArea('PII exposure')).toBe('privacy');
    expect(resolveArea('tool selection accuracy')).toBe('agent-behavior');
    expect(resolveArea('bias')).toBe('fairness');
  });

  it('falls back to a substring match on a compound label', () => {
    expect(resolveArea('security/prompt-injection ASR')).toBe('security');
  });

  it('returns undefined rather than guessing at an unknown label', () => {
    expect(resolveArea('vibes')).toBeUndefined();
    expect(resolveArea('')).toBeUndefined();
  });
});

describe('normalizeRow', () => {
  it('resolves the area from the parameter when no area column exists', () => {
    const outcome = normalizeRow({ metric: 'hallucination rate', value: '3%' });
    expect('result' in outcome).toBe(true);
    if ('result' in outcome) {
      expect(outcome.result.area).toBe('factual-reliability');
      expect(outcome.result.metricValue).toBe(3);
      expect(outcome.result.unit).toBe('percent');
    }
  });

  it('reports an unmappable row instead of filing it in the wrong area', () => {
    const outcome = normalizeRow({ area: 'vibes check', value: 7 });
    expect('unmapped' in outcome).toBe(true);
  });

  it('skips a row with neither a value nor an observation', () => {
    const outcome = normalizeRow({ area: 'safety', parameter: 'violations' });
    expect('skipped' in outcome).toBe(true);
  });

  it('tolerates any casing convention in the field names', () => {
    const outcome = normalizeRow({
      'Review Area': 'safety',
      Metric_Name: 'severe violations',
      Value: 0,
      sample_size: 500,
    });
    expect('result' in outcome).toBe(true);
    if ('result' in outcome) {
      expect(outcome.result.area).toBe('safety');
      expect(outcome.result.sampleSize).toBe(500);
    }
  });
});

describe('parseJsonEvidence', () => {
  it('reads a flat array of rows', () => {
    const outcome = parseJsonEvidence([
      { area: 'safety', parameter: 'severe violations', value: 0 },
      { area: 'security', parameter: 'jailbreak ASR', value: '0%' },
    ]);
    expect(outcome.results).toHaveLength(2);
    expect(outcome.unmapped).toHaveLength(0);
  });

  it('reads a wrapped results array', () => {
    const outcome = parseJsonEvidence({
      runId: 'abc',
      results: [{ area: 'privacy', parameter: 'PII leaks', value: 0 }],
    });
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].area).toBe('privacy');
  });

  it('reads an object keyed by review area', () => {
    const outcome = parseJsonEvidence({
      safety: [{ parameter: 'severe violations', value: 0 }],
      security: { parameter: 'prompt injection ASR', value: '0%' },
    });
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results.map((r) => r.area).sort()).toEqual(['safety', 'security']);
  });

  it('reads a flat metric map', () => {
    const outcome = parseJsonEvidence({ hallucination_rate: 0.03, jailbreak: 0 });
    expect(outcome.results).toHaveLength(2);
  });

  it('warns rather than throwing on an empty payload', () => {
    const outcome = parseJsonEvidence({});
    expect(outcome.results).toHaveLength(0);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });

  it('surfaces unmappable rows as a warning', () => {
    const outcome = parseJsonEvidence([{ area: 'vibes', parameter: 'general feel', value: 8 }]);
    expect(outcome.results).toHaveLength(0);
    expect(outcome.unmapped).toHaveLength(1);
    expect(outcome.warnings.join(' ')).toContain('could not be mapped');
  });
});

describe('parseCsv', () => {
  it('reads a simple table', () => {
    const rows = parseCsv('area,parameter,value\nsafety,violations,0\n');
    expect(rows).toEqual([{ area: 'safety', parameter: 'violations', value: '0' }]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('area,note\nsafety,"zero severe, two low-severity"\n');
    expect(rows[0].note).toBe('zero severe, two low-severity');
  });

  it('handles escaped quotes', () => {
    const rows = parseCsv('area,note\nsafety,"the ""severe"" bucket was empty"\n');
    expect(rows[0].note).toBe('the "severe" bucket was empty');
  });

  it('handles embedded newlines inside quotes', () => {
    const rows = parseCsv('area,note\nsafety,"line one\nline two"\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe('line one\nline two');
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('area,value\r\nsafety,0\r\nsecurity,1\r\n');
    expect(rows).toHaveLength(2);
  });

  it('returns nothing for a header with no data rows', () => {
    expect(parseCsv('area,value\n')).toEqual([]);
  });
});

describe('parseCsvEvidence', () => {
  it('normalizes a realistic export', () => {
    const csv = [
      'Review Area,Parameter,Value,Unit,Sample Size',
      'Business effectiveness,task completion,93,percent,400',
      'Safety,severe violations,0,count,1000',
      'Security,prompt injection ASR,0%,,250',
    ].join('\n');

    const outcome = parseCsvEvidence(csv);
    expect(outcome.results).toHaveLength(3);
    expect(outcome.results[0].area).toBe('business-effectiveness');
    expect(outcome.results[0].sampleSize).toBe(400);
    expect(outcome.results[2].unit).toBe('percent');
  });
});

describe('parseMarkdownEvidence', () => {
  it('reads the first pipe table in a document', () => {
    const md = [
      '# Eval writeup',
      '',
      'Some prose that is not a table.',
      '',
      '| Review area | Parameter | Value |',
      '| --- | --- | --- |',
      '| Safety | severe violations | 0 |',
      '| Response quality | average rating | 4.3 / 5 |',
      '',
      'Trailing prose.',
    ].join('\n');

    const outcome = parseMarkdownEvidence(md);
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results[1].unit).toBe('score-5');
  });

  it('warns when there is no table to read', () => {
    const outcome = parseMarkdownEvidence('# Just a heading\n\nAnd a paragraph.');
    expect(outcome.results).toHaveLength(0);
    expect(outcome.warnings[0]).toContain('No Markdown table');
  });
});

describe('parseEvidenceFile', () => {
  it('dispatches on a .json extension', () => {
    const outcome = parseEvidenceFile(
      'run.json',
      'application/json',
      '[{"area":"safety","parameter":"violations","value":0}]',
    );
    expect(outcome.results).toHaveLength(1);
  });

  it('reports invalid JSON as a warning rather than throwing', () => {
    const outcome = parseEvidenceFile('run.json', 'application/json', '{not json');
    expect(outcome.results).toHaveLength(0);
    expect(outcome.warnings[0]).toContain('not valid JSON');
  });

  it('sniffs JSON content behind an unknown extension', () => {
    const outcome = parseEvidenceFile(
      'export.txt',
      'text/plain',
      '[{"area":"security","parameter":"jailbreak ASR","value":0}]',
    );
    expect(outcome.results).toHaveLength(1);
  });

  it('falls back to CSV for unknown extensions with tabular content', () => {
    const outcome = parseEvidenceFile('export.dat', '', 'area,parameter,value\nsafety,violations,0\n');
    expect(outcome.results).toHaveLength(1);
  });
});
