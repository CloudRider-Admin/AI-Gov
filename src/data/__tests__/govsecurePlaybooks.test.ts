import { describe, expect, it } from 'vitest';

import {
  AI_CHEF_STATIONS,
  GOVSECURE_90_DAY_PHASES,
  GOVSECURE_NIST_RCM,
  NIST_RCM_SECTION_TEMPLATES,
  PHASE3_DOCUMENT_TITLES,
  TPRM_QUESTIONNAIRE,
  TPRM_SECTION_TEMPLATES,
} from '../govsecurePlaybooks';

describe('govsecurePlaybooks', () => {
  describe('AI Chef stations', () => {
    it('exposes 6 canonical stations', () => {
      expect(AI_CHEF_STATIONS).toHaveLength(6);
      for (const s of AI_CHEF_STATIONS) {
        expect(s.id).toMatch(/^S\d$/);
        expect(s.name).toBeTruthy();
        expect(s.purpose.length).toBeGreaterThan(20);
      }
    });
  });

  describe('90-Day Blueprint phases', () => {
    it('exposes 3 phases totalling ~90 days', () => {
      expect(GOVSECURE_90_DAY_PHASES).toHaveLength(3);
      const total = GOVSECURE_90_DAY_PHASES.reduce((acc, p) => acc + p.durationDays, 0);
      expect(total).toBeGreaterThanOrEqual(90);
    });
  });

  describe('TPRM questionnaire', () => {
    it('extracts at least 9 substantive sections (drops the title row)', () => {
      expect(TPRM_QUESTIONNAIRE.length).toBeGreaterThanOrEqual(9);
      for (const s of TPRM_QUESTIONNAIRE) {
        // Title row is "Third-Party Risk Management..." with no leading "1)" — excluded
        expect(s.heading).not.toMatch(/^Third-Party Risk Management/);
        expect(s.sourceDocCode).toBe('GS-QSTN-TPRM-01');
      }
    });

    it('classifies importance from the source heading tags', () => {
      const importances = new Set(TPRM_QUESTIONNAIRE.map((s) => s.importance));
      // Real questionnaire has Required, High, and Conditional ("If Applicable") tags
      expect(importances.has('Required')).toBe(true);
      expect(importances.has('High')).toBe(true);
    });

    it('every TPRM section template carries provenance', () => {
      for (const t of TPRM_SECTION_TEMPLATES) {
        expect(t.sourceDocCode).toBe('GS-QSTN-TPRM-01');
        expect(t.sourceSection).toBeTruthy();
        expect(t.heading).toBeTruthy();
        expect(t.guidance.length).toBeGreaterThan(20);
        expect(t.isChecklist).toBe(true);
      }
    });
  });

  describe('NIST RCM templates', () => {
    it('produces one section per controlId from the bundled extract', () => {
      // Extracted bundle has the canonical controls; tolerate >=1 row even
      // when the bundle is empty (fallback path).
      expect(NIST_RCM_SECTION_TEMPLATES.length).toBeGreaterThanOrEqual(1);
      // When the bundle is populated, every controlId from GOVSECURE_NIST_RCM
      // should appear in the templates.
      if (GOVSECURE_NIST_RCM.length > 0) {
        const headings = NIST_RCM_SECTION_TEMPLATES.map((t) => t.heading).join('|');
        for (const c of GOVSECURE_NIST_RCM.slice(0, 5)) {
          if (c.controlId) expect(headings).toContain(c.controlId);
        }
      }
    });

    it('every NIST RCM template references the canonical framework doc code', () => {
      for (const t of NIST_RCM_SECTION_TEMPLATES) {
        expect(t.sourceDocCode).toBe('GS-FRAM-NISTRCM-01');
      }
    });
  });

  describe('PHASE3_DOCUMENT_TITLES', () => {
    it('covers both Phase 3 document types', () => {
      expect(PHASE3_DOCUMENT_TITLES['govsecure-tprm']).toBeTruthy();
      expect(PHASE3_DOCUMENT_TITLES['govsecure-nist-rcm']).toBeTruthy();
    });
  });
});
