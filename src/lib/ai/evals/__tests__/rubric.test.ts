import { describe, expect, it } from 'vitest';

import {
  buildCaseScore,
  computeOverall,
  findSuspiciousCitations,
  PASS_THRESHOLD,
  RUBRIC_VERSION,
  scoreDeterministic,
} from '../rubric';
import type { DocumentGenerationGolden } from '../types';

const DOC_CASE: DocumentGenerationGolden = {
  id: 'doc-test',
  category: 'document-generation',
  documentType: 'use-case-summary',
  input: {
    useCaseDescription: 'Sample use case for unit test.',
    riskTier: 'Medium',
  },
  expectedSections: ['Purpose', 'Scope', 'Data'],
  requiredClauses: ['human review', 'AI Governance Lead'],
  forbiddenContent: ['Article 99'],
};

describe('rubric.ts', () => {
  it('exposes a stable rubric version', () => {
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  describe('scoreDeterministic', () => {
    it('marks every required clause as found when all are present', () => {
      const text = '## Purpose\nThe AI Governance Lead approves.\n## Scope\nHuman review applies.\n## Data\nMinimised.';
      const det = scoreDeterministic(text, {
        expectedSections: DOC_CASE.expectedSections,
        requiredClauses: DOC_CASE.requiredClauses,
        forbiddenContent: DOC_CASE.forbiddenContent,
      });
      expect(det.structureMatch).toBe(1);
      expect(det.requiredClausesPresent).toBe(1);
      expect(det.hallucinationCheck).toBe('pass');
      expect(det.missingClauses).toEqual([]);
      expect(det.forbiddenHits).toEqual([]);
    });

    it('reports missing clauses and partial structure', () => {
      const text = '## Purpose\nThe AI Governance Lead approves.';
      const det = scoreDeterministic(text, {
        expectedSections: DOC_CASE.expectedSections,
        requiredClauses: DOC_CASE.requiredClauses,
        forbiddenContent: DOC_CASE.forbiddenContent,
      });
      expect(det.structureMatch).toBeCloseTo(1 / 3, 3);
      expect(det.requiredClausesPresent).toBe(0.5);
      expect(det.missingClauses).toContain('human review');
      expect(det.hallucinationCheck).toBe('pass');
    });

    it('fails hallucinationCheck when forbidden content appears', () => {
      const text = '## Purpose\nSee Article 99 of EU AI Act.';
      const det = scoreDeterministic(text, {
        expectedSections: ['Purpose'],
        requiredClauses: [],
        forbiddenContent: ['Article 99'],
      });
      expect(det.hallucinationCheck).toBe('fail');
      expect(det.forbiddenHits.some((h) => h.includes('Article 99'))).toBe(true);
    });

    it('catches suspicious NIST control IDs via the regex tripwire', () => {
      const text = 'Refer to GOVERN-25 and MAP-99 for guidance.';
      const det = scoreDeterministic(text, {
        expectedSections: [],
        requiredClauses: [],
        forbiddenContent: [],
      });
      expect(det.hallucinationCheck).toBe('fail');
      const flagged = det.forbiddenHits.filter((h) => h.startsWith('suspicious-citation:'));
      expect(flagged.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 1.0 structure when no expected sections are provided', () => {
      const det = scoreDeterministic('arbitrary text', {
        expectedSections: [],
        requiredClauses: [],
        forbiddenContent: [],
      });
      expect(det.structureMatch).toBe(1);
      expect(det.requiredClausesPresent).toBe(1);
    });
  });

  describe('findSuspiciousCitations', () => {
    it('does not flag plausible citations', () => {
      const hits = findSuspiciousCitations('Article 5 of EU AI Act and GOVERN-1.2 of NIST AI RMF.');
      expect(hits).toEqual([]);
    });

    it('flags absurdly high article numbers', () => {
      const hits = findSuspiciousCitations('See Article 250 and Recital 999.');
      expect(hits.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('computeOverall', () => {
    it('weights components correctly', () => {
      const overall = computeOverall(
        {
          structureMatch: 1,
          requiredClausesPresent: 1,
          hallucinationCheck: 'pass',
          missingClauses: [],
          forbiddenHits: [],
        },
        { voiceMatch: 1 },
      );
      expect(overall).toBe(1);
    });

    it('drops to a non-passing score when hallucination check fails', () => {
      const overall = computeOverall(
        {
          structureMatch: 1,
          requiredClausesPresent: 1,
          hallucinationCheck: 'fail',
          missingClauses: [],
          forbiddenHits: ['Article 99'],
        },
        { voiceMatch: 1 },
      );
      expect(overall).toBeLessThan(1);
      expect(overall).toBeCloseTo(0.9, 3);
    });
  });

  describe('buildCaseScore', () => {
    it('marks a perfect score as passed', () => {
      const score = buildCaseScore(
        DOC_CASE,
        {
          structureMatch: 1,
          requiredClausesPresent: 1,
          hallucinationCheck: 'pass',
          missingClauses: [],
          forbiddenHits: [],
        },
        { voiceMatch: 1 },
        50,
      );
      expect(score.passed).toBe(true);
      expect(score.overall).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    });

    it('marks an errored case as not passed', () => {
      const score = buildCaseScore(
        DOC_CASE,
        {
          structureMatch: 1,
          requiredClausesPresent: 1,
          hallucinationCheck: 'pass',
          missingClauses: [],
          forbiddenHits: [],
        },
        { voiceMatch: 1 },
        50,
        'orchestrator blew up',
      );
      expect(score.passed).toBe(false);
      expect(score.error).toBe('orchestrator blew up');
    });
  });
});
