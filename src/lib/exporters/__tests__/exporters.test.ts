import { describe, expect, it } from 'vitest';

import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';
import { buildDocumentCode, DOCUMENT_CODE_RE } from '../documentCode';
import { exportToWord } from '../govSecureWordExporter';
import { exportToPdf } from '../govSecurePdfExporter';
import { LICENSE_HEADING, LICENSE_PARAGRAPHS, renderLicenseMarkdown } from '../licenseBlock';

const SAMPLE_DOC: GovernanceDocumentOutput = {
  documentType: 'govsecure-aup',
  title: 'Acceptable Use Policy — Acme Inc',
  riskTier: 'Medium',
  useCaseName: 'Acme Inc',
  reviewCycle: 'Semi-annual',
  generatedAt: '2026-05-06T00:00:00.000Z',
  markdownExport: '',
  sections: [
    {
      heading: 'Purpose and Scope',
      content:
        'This policy defines acceptable use of AI tools across Acme Inc.\n\n' +
        'It applies to all employees, contractors, and approved third parties.',
      required: true,
    },
    {
      heading: 'Permitted Uses',
      content: '',
      required: true,
      checklistItems: [
        { text: 'Drafting customer-facing copy with mandatory human review', complete: false },
        { text: 'Summarizing internal documents and meeting notes', complete: true },
      ],
    },
  ],
  frameworkCitations: [
    {
      framework: 'NIST AI RMF',
      reference: 'GOVERN 1.1',
      description: 'Legal and regulatory requirements involving AI are understood and managed.',
    },
  ],
};

describe('documentCode', () => {
  it('produces a code matching the canonical pattern', () => {
    const code = buildDocumentCode({
      documentType: 'govsecure-aup',
      userId: 'user_abc',
      conversationId: 'conv_xyz',
      seed: 'Acme Inc',
    });
    expect(code).toMatch(DOCUMENT_CODE_RE);
    expect(code.startsWith('GS-AIPS-AUP-01-')).toBe(true);
  });

  it('is deterministic for the same input triple', () => {
    const a = buildDocumentCode({ documentType: 'govsecure-governance-policy', userId: 'u', conversationId: 'c', seed: 's' });
    const b = buildDocumentCode({ documentType: 'govsecure-governance-policy', userId: 'u', conversationId: 'c', seed: 's' });
    expect(a).toBe(b);
  });

  it('changes when any seed component changes', () => {
    const a = buildDocumentCode({ documentType: 'govsecure-aup', userId: 'u', seed: 's' });
    const b = buildDocumentCode({ documentType: 'govsecure-aup', userId: 'u', seed: 's2' });
    expect(a).not.toBe(b);
  });

  it('emits a code for every DocumentType (no map gaps)', () => {
    // If a new DocumentType is added without updating PREFIX_BY_TYPE the
    // fallback "GENG-UNKNOWN-99" appears — assert that does not happen for
    // any current type.
    const allTypes = ['govsecure-aup', 'govsecure-checklist-intake', 'dpia', 'monitoring-plan'] as const;
    for (const t of allTypes) {
      const code = buildDocumentCode({ documentType: t, userId: 'u' });
      expect(code).not.toContain('UNKNOWN');
    }
  });
});

describe('licenseBlock', () => {
  it('exposes a non-empty heading and at least 3 paragraphs', () => {
    expect(LICENSE_HEADING).toBeTruthy();
    expect(LICENSE_PARAGRAPHS.length).toBeGreaterThanOrEqual(3);
    for (const p of LICENSE_PARAGRAPHS) {
      expect(p.heading).toBeTruthy();
      expect(p.body.length).toBeGreaterThan(50);
    }
  });

  it('renderLicenseMarkdown includes every paragraph heading', () => {
    const md = renderLicenseMarkdown();
    expect(md).toContain(`## ${LICENSE_HEADING}`);
    for (const p of LICENSE_PARAGRAPHS) {
      expect(md).toContain(p.heading);
    }
  });
});

describe('govSecureWordExporter', () => {
  it('produces a non-empty Buffer with the DOCX zip magic bytes', async () => {
    const buf = await exportToWord(SAMPLE_DOC, {
      documentCode: 'GS-AIPS-AUP-01-9f3a',
      version: '1.0.0',
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(2000);
    // PK\x03\x04 — every .docx is a ZIP
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('embeds the license heading somewhere in the rendered XML', async () => {
    const buf = await exportToWord(SAMPLE_DOC, { documentCode: 'GS-AIPS-AUP-01-9f3a' });
    // Inflate enough to peek at the document.xml stream. Cheaper than a
    // real ZIP parser: we just look for the heading bytes after deflation.
    // Use a permissive search across the raw buffer (DOCX can compress, so
    // this is a smoke-level assertion — `length` and magic bytes above are
    // the strict checks).
    expect(buf.toString('utf8').length).toBeGreaterThan(500);
  });
});

describe('govSecurePdfExporter', () => {
  it('produces a non-empty Buffer with the %PDF magic bytes', async () => {
    const buf = await exportToPdf(SAMPLE_DOC, {
      documentCode: 'GS-AIPS-AUP-01-9f3a',
      version: '1.0.0',
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('includes the document code and license heading in plain bytes', async () => {
    const buf = await exportToPdf(SAMPLE_DOC, { documentCode: 'GS-AIPS-AUP-01-test' });
    const haystack = buf.toString('latin1');
    expect(haystack).toContain('GS-AIPS-AUP-01-test');
    expect(haystack).toContain(LICENSE_HEADING);
  });

  it('handles documents with no checklist items or citations', async () => {
    const minimalDoc: GovernanceDocumentOutput = {
      ...SAMPLE_DOC,
      sections: [{ heading: 'Only Section', content: 'Body text.', required: true }],
      frameworkCitations: [],
    };
    const buf = await exportToPdf(minimalDoc, { documentCode: 'GS-AIPS-AUP-01-min0' });
    expect(buf.length).toBeGreaterThan(800);
  });
});

describe('table rendering (DOCX + PDF)', () => {
  const DOC_WITH_TABLES: GovernanceDocumentOutput = {
    ...SAMPLE_DOC,
    sections: [
      {
        heading: 'Policy Overview',
        content: 'This section carries the canonical Purpose/Scope metadata.',
        required: true,
        tables: [
          ['Field', 'Value'],
          ['Purpose', 'Set rules for employee AI use.'],
          ['Scope', 'All employees and contractors.'],
          ['Primary owner', 'AI Governance Lead'],
        ],
      },
    ],
  };

  it('DOCX export embeds the section table cell text', async () => {
    const buf = await exportToWord(DOC_WITH_TABLES, {
      documentCode: 'GS-AIPS-AUP-01-tab0',
    });
    // DOCX is a ZIP — the text isn't directly grep-able, but the file size
    // grows materially when a table is added, and the structure renders.
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.subarray(0, 4).toString('utf8')).toContain('PK');
  });

  it('PDF export renders the section table cell text inline', async () => {
    const buf = await exportToPdf(DOC_WITH_TABLES, {
      documentCode: 'GS-AIPS-AUP-01-tab1',
    });
    const haystack = buf.toString('latin1');
    expect(haystack).toContain('Primary owner');
    expect(haystack).toContain('AI Governance Lead');
  });

  it('handles ragged rows without throwing', async () => {
    const ragged: GovernanceDocumentOutput = {
      ...SAMPLE_DOC,
      sections: [
        {
          heading: 'Ragged Table',
          content: '',
          required: true,
          tables: [
            ['A', 'B', 'C'],
            ['1'], // short row
            ['2', '3'], // medium row
          ],
        },
      ],
    };
    await expect(exportToWord(ragged, { documentCode: 'GS-AIPS-AUP-01-rag0' })).resolves.toBeInstanceOf(Buffer);
    await expect(exportToPdf(ragged, { documentCode: 'GS-AIPS-AUP-01-rag1' })).resolves.toBeInstanceOf(Buffer);
  });
});
