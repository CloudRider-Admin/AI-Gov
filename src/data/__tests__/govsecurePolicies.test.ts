import { describe, expect, it } from 'vitest';

import {
  GOVSECURE_CHECKLIST_SECTION_TEMPLATES,
  GOVSECURE_DOCUMENT_TEMPLATES,
  GOVSECURE_DOCUMENT_TITLES,
  GOVSECURE_DOCUMENT_TYPE_VALUES,
  GOVSECURE_POLICY_SECTION_TEMPLATES,
} from '../govsecurePolicies';

describe('govsecurePolicies', () => {
  it('exposes 9 policy types and 14 checklist types', () => {
    expect(Object.keys(GOVSECURE_POLICY_SECTION_TEMPLATES)).toHaveLength(9);
    expect(Object.keys(GOVSECURE_CHECKLIST_SECTION_TEMPLATES)).toHaveLength(14);
    expect(GOVSECURE_DOCUMENT_TYPE_VALUES).toHaveLength(23);
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

  it('every document type carries at least one voice-anchor section', () => {
    // The policy curation refactor anchors one representative voice exemplar
    // per document (the first section) rather than scraping context onto every
    // section. The primary generation-time voice anchor is the source-document
    // prose selected by `getExemplarsForGeneration` (see exemplarRetrieval.ts);
    // `govsecureContext` is the per-document fallback anchor. The invariant that
    // matters is therefore "every type has ≥1 anchor", not a per-section ratio.
    for (const [type, templates] of Object.entries(GOVSECURE_DOCUMENT_TEMPLATES)) {
      const anchored = templates.filter(
        (t) => t.govsecureContext && t.govsecureContext.length > 0,
      );
      expect(anchored.length, `${type} has no voice-anchor section`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every type has a human display title', () => {
    for (const type of GOVSECURE_DOCUMENT_TYPE_VALUES) {
      expect(GOVSECURE_DOCUMENT_TITLES[type]).toBeTruthy();
    }
  });
});
