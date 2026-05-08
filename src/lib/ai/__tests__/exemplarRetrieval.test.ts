import { describe, expect, it } from 'vitest';

import { GOVSECURE_DOCUMENT_TYPE_VALUES } from '@/data/govsecurePolicies';
import { getExemplarsForGeneration, renderExemplarBlock } from '../exemplarRetrieval';

describe('exemplarRetrieval', () => {
  it('returns at least one exemplar for every supported GovSecure document type', () => {
    const failures: string[] = [];
    for (const type of GOVSECURE_DOCUMENT_TYPE_VALUES) {
      const exemplars = getExemplarsForGeneration(type, []);
      if (exemplars.length === 0) failures.push(type);
    }
    expect(failures).toEqual([]);
  });

  it('returns no exemplars for non-GovSecure document types', () => {
    expect(getExemplarsForGeneration('use-case-summary', ['Purpose'])).toEqual([]);
    expect(getExemplarsForGeneration('dpia', ['Necessity'])).toEqual([]);
    expect(getExemplarsForGeneration('threat-model', ['Asset'])).toEqual([]);
  });

  it('respects maxExemplars', () => {
    const exemplars = getExemplarsForGeneration('govsecure-aup', [], { maxExemplars: 1 });
    expect(exemplars).toHaveLength(1);
  });

  it('respects targetTokens (no exemplar exceeds budget)', () => {
    const budget = 200;
    const exemplars = getExemplarsForGeneration('govsecure-governance-policy', [], {
      targetTokens: budget,
      maxExemplars: 5,
    });
    const total = exemplars.reduce((acc, e) => acc + e.tokenCount, 0);
    expect(total).toBeLessThanOrEqual(budget + 10); // +10 slack for trim heuristic
  });

  it('prefers sections matching requested headings', () => {
    // The acceptable-use policy has a "Permitted Uses" section. When we ask
    // for it explicitly, it should appear in the picked exemplars.
    const exemplars = getExemplarsForGeneration(
      'govsecure-aup',
      ['Permitted Uses'],
      { maxExemplars: 1, targetTokens: 1000 },
    );
    expect(exemplars).toHaveLength(1);
    expect(exemplars[0].heading.toLowerCase()).toContain('permitted');
  });

  it('every exemplar carries provenance (documentCode, sectionId, heading)', () => {
    const exemplars = getExemplarsForGeneration('govsecure-incident-response-policy', []);
    expect(exemplars.length).toBeGreaterThan(0);
    for (const e of exemplars) {
      expect(e.documentCode).toMatch(/^GS-/);
      expect(e.sectionId).toBeTruthy();
      expect(e.heading).toBeTruthy();
      expect(e.prose.length).toBeGreaterThan(20);
      expect(e.tokenCount).toBeGreaterThan(0);
    }
  });

  describe('renderExemplarBlock', () => {
    it('returns empty string when no exemplars are supplied', () => {
      expect(renderExemplarBlock([], 'Acceptable Use Policy')).toBe('');
    });

    it('produces a labeled block with provenance markers', () => {
      const exemplars = getExemplarsForGeneration('govsecure-data-privacy-policy', [], {
        maxExemplars: 2,
      });
      const block = renderExemplarBlock(exemplars, 'AI Data Privacy Policy');
      expect(block).toContain('REFERENCE EXEMPLARS');
      expect(block).toContain('AI Data Privacy Policy');
      for (const e of exemplars) {
        expect(block).toContain(e.documentCode);
        expect(block).toContain(e.heading);
      }
    });
  });
});
