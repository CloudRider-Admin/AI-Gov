import { describe, expect, it } from 'vitest';

import {
  GOVSECURE_CHECKLIST_SECTION_TEMPLATES,
  GOVSECURE_DOCUMENT_TEMPLATES,
  GOVSECURE_DOCUMENT_TITLES,
  GOVSECURE_DOCUMENT_TYPE_VALUES,
  GOVSECURE_POLICY_SECTION_TEMPLATES,
} from '../govsecurePolicies';

describe('govsecurePolicies', () => {
  it('exposes 8 policy types and 14 checklist types', () => {
    expect(Object.keys(GOVSECURE_POLICY_SECTION_TEMPLATES)).toHaveLength(8);
    expect(Object.keys(GOVSECURE_CHECKLIST_SECTION_TEMPLATES)).toHaveLength(14);
    expect(GOVSECURE_DOCUMENT_TYPE_VALUES).toHaveLength(22);
  });

  it('every type has a non-empty SectionTemplate[] (≥3 sections)', () => {
    for (const [type, templates] of Object.entries(GOVSECURE_DOCUMENT_TEMPLATES)) {
      expect(templates.length, `${type} has too few sections`).toBeGreaterThanOrEqual(3);
    }
  });

  it('every section carries provenance (sourceDocCode + sourceSection)', () => {
    for (const [type, templates] of Object.entries(GOVSECURE_DOCUMENT_TEMPLATES)) {
      for (const t of templates) {
        expect(t.sourceDocCode, `${type}/${t.heading} missing sourceDocCode`).toMatch(/^GS-/);
        expect(t.sourceSection, `${type}/${t.heading} missing sourceSection`).toBeTruthy();
      }
    }
  });

  it('every section carries a non-empty heading and guidance string', () => {
    for (const [type, templates] of Object.entries(GOVSECURE_DOCUMENT_TEMPLATES)) {
      for (const t of templates) {
        expect(t.heading, `${type} has empty heading`).toBeTruthy();
        expect(t.guidance.length, `${type}/${t.heading} guidance is empty`).toBeGreaterThan(10);
      }
    }
  });

  it('checklists are flagged as isChecklist; policies are not', () => {
    for (const t of Object.values(GOVSECURE_POLICY_SECTION_TEMPLATES).flat()) {
      expect(t.isChecklist).toBe(false);
    }
    for (const t of Object.values(GOVSECURE_CHECKLIST_SECTION_TEMPLATES).flat()) {
      expect(t.isChecklist).toBe(true);
    }
  });

  it('voice-anchor context is populated for at least 60% of sections', () => {
    // Some source sections are heading-only with no body — those legitimately
    // produce no context. 60% is enough to make the exemplar block useful in
    // Phase 2.5 without flapping when the extractor is updated.
    const all = Object.values(GOVSECURE_DOCUMENT_TEMPLATES).flat();
    const withContext = all.filter((t) => t.govsecureContext && t.govsecureContext.length > 0);
    expect(withContext.length / all.length).toBeGreaterThanOrEqual(0.6);
  });

  it('every type has a human display title', () => {
    for (const type of GOVSECURE_DOCUMENT_TYPE_VALUES) {
      expect(GOVSECURE_DOCUMENT_TITLES[type]).toBeTruthy();
    }
  });
});
