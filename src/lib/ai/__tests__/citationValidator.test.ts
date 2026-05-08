import { describe, expect, it } from 'vitest';

import {
  flattenStrings,
  STRIP_THRESHOLD,
  stripCitations,
  unverifiedCitations,
  validateCitations,
} from '../citationValidator';

describe('citationValidator', () => {
  describe('NIST AI RMF subcategories', () => {
    it('verifies a real subcategory ID in canonical form', () => {
      const checks = validateCitations('Per GOVERN 1.1, the team must document.');
      expect(checks).toHaveLength(1);
      expect(checks[0].verified).toBe(true);
      expect(checks[0].canonical).toBe('GOVERN 1.1');
      expect(checks[0].source).toBe('NIST AI RMF Playbook');
    });

    it('verifies a real subcategory ID in dashed form', () => {
      const checks = validateCitations('Refer to GOVERN-1.2 for guidance.');
      expect(checks).toHaveLength(1);
      expect(checks[0].verified).toBe(true);
    });

    it('flags a fabricated NIST subcategory ID', () => {
      const checks = validateCitations('See GOVERN-99 of NIST AI RMF.');
      const unverified = unverifiedCitations(checks);
      expect(unverified).toHaveLength(1);
      expect(unverified[0].canonical).toBe('GOVERN 99');
      expect(unverified[0].reason).toMatch(/registry/);
    });

    it('deduplicates the same control cited multiple times', () => {
      const checks = validateCitations('GOVERN 1.1 and GOVERN 1.1 and GOVERN 1.1.');
      expect(checks).toHaveLength(1);
    });
  });

  describe('EU AI Act articles', () => {
    it('verifies Article 5 (prohibited practices)', () => {
      const checks = validateCitations('Article 5 of the EU AI Act prohibits social scoring.');
      const eu = checks.filter((c) => c.type === 'eu-ai-act-article');
      expect(eu).toHaveLength(1);
      expect(eu[0].verified).toBe(true);
    });

    it('verifies the alternate "EU AI Act Article N" phrasing', () => {
      const checks = validateCitations('See EU AI Act Article 50 for transparency.');
      const eu = checks.filter((c) => c.type === 'eu-ai-act-article');
      expect(eu).toHaveLength(1);
      expect(eu[0].verified).toBe(true);
    });

    it('flags Article 250 (does not exist)', () => {
      const checks = validateCitations('Article 250 of the EU AI Act applies.');
      const unverified = unverifiedCitations(checks);
      expect(unverified.some((u) => u.type === 'eu-ai-act-article')).toBe(true);
    });
  });

  describe('GDPR articles', () => {
    it('verifies Article 22 of GDPR', () => {
      const checks = validateCitations('Per Article 22 of GDPR, automated decisions need a human review path.');
      const gdpr = checks.filter((c) => c.type === 'gdpr-article');
      expect(gdpr).toHaveLength(1);
      expect(gdpr[0].verified).toBe(true);
    });

    it('flags Article 250 of GDPR (does not exist)', () => {
      const checks = validateCitations('Article 250 of GDPR applies here.');
      expect(unverifiedCitations(checks).some((u) => u.type === 'gdpr-article')).toBe(true);
    });
  });

  describe('ISO/IEC 42001 clauses', () => {
    it('verifies a real clause', () => {
      const checks = validateCitations('Per ISO/IEC 42001 Clause 6, plan the AI management system.');
      const iso = checks.filter((c) => c.type === 'iso-clause');
      expect(iso).toHaveLength(1);
      expect(iso[0].verified).toBe(true);
    });

    it('flags Clause 99', () => {
      const checks = validateCitations('ISO/IEC 42001 Clause 99 requires...');
      const iso = checks.filter((c) => c.type === 'iso-clause');
      expect(iso).toHaveLength(1);
      expect(iso[0].verified).toBe(false);
    });

    it('verifies known annexes', () => {
      const checks = validateCitations('See ISO/IEC 42001 Annex A for controls.');
      const iso = checks.filter((c) => c.type === 'iso-clause');
      expect(iso).toHaveLength(1);
      expect(iso[0].verified).toBe(true);
    });
  });

  describe('GovSecure templates', () => {
    it('verifies a template code that exists in the bundled manifest', () => {
      const checks = validateCitations('Use GS-AIPS-GOVERNAN-03 as a starting point.');
      const tpl = checks.filter((c) => c.type === 'govsecure-template');
      expect(tpl).toHaveLength(1);
      expect(tpl[0].verified).toBe(true);
    });

    it('flags an unknown template code by default (manifest-anchored)', () => {
      const checks = validateCitations('Reference GS-FAKE-CODE-99 in the policy.');
      const tpl = checks.filter((c) => c.type === 'govsecure-template');
      expect(tpl).toHaveLength(1);
      expect(tpl[0].verified).toBe(false);
      expect(tpl[0].reason).toBe('template code not in manifest');
    });

    it('honors an explicit override registry (replacing the default manifest)', () => {
      const checks = validateCitations('Use GS-AIPS-GOVERNAN-03 instead.', {
        govsecureTemplates: new Set(['GS-OTHER-CODE-01']),
      });
      const tpl = checks.filter((c) => c.type === 'govsecure-template');
      expect(tpl).toHaveLength(1);
      expect(tpl[0].verified).toBe(false);
    });
  });

  describe('false-positive rate sanity check', () => {
    it('does not flag canonical text drawn from the seed corpus', () => {
      // Mix of references that should all verify cleanly.
      const text = `
        The team aligns with GOVERN 1.1 and MAP 1.1.
        Article 5 of the EU AI Act prohibits social scoring.
        Article 22 of GDPR governs automated decision-making.
        ISO/IEC 42001 Clause 6 covers planning.
      `;
      const checks = validateCitations(text);
      const unverified = unverifiedCitations(checks);
      expect(unverified).toEqual([]);
      expect(checks.length).toBeGreaterThanOrEqual(4);
    });

    it('still flags fabricated citations even when surrounded by valid ones', () => {
      const text = 'Per GOVERN 1.1 and Article 5 of the EU AI Act, see also GOVERN-99.';
      const unverified = unverifiedCitations(validateCitations(text));
      expect(unverified).toHaveLength(1);
      expect(unverified[0].canonical).toBe('GOVERN 99');
    });
  });

  describe('flattenStrings', () => {
    it('walks nested objects and arrays', () => {
      const value = {
        a: 'hello',
        b: { c: ['world', { d: 'foo' }] },
        e: 42,
        f: null,
      };
      const flat = flattenStrings(value);
      expect(flat).toContain('hello');
      expect(flat).toContain('world');
      expect(flat).toContain('foo');
      expect(flat).not.toContain('42');
    });
  });

  describe('stripCitations', () => {
    it('replaces unverified citations with a marker', () => {
      const text = 'Per GOVERN-99 the policy must change.';
      const unverified = unverifiedCitations(validateCitations(text));
      const stripped = stripCitations(text, unverified);
      expect(stripped).not.toContain('GOVERN-99');
      expect(stripped).toContain('[nist-control: unverified]');
    });
  });

  describe('STRIP_THRESHOLD', () => {
    it('is greater than zero so single false positives do not strip', () => {
      expect(STRIP_THRESHOLD).toBeGreaterThan(0);
    });
  });
});
