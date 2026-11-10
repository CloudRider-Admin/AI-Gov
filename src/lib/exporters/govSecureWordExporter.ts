/**
 * Branded GovSecure DOCX exporter — colourful, modern template (Phase 2.6.1).
 *
 * Renders a `GovernanceDocumentOutput` as a polished .docx that mirrors the
 * visual language of the branded PDF exporter:
 *   - Green cover banner with the document-type eyebrow, title, and prepared-for
 *     line.
 *   - A washed metadata panel (document code, risk tier in tier colour, version,
 *     generated date, review cycle).
 *   - Shaded section heading bands with an accent left spine.
 *   - Checkbox checklists and an accent-tagged framework-references list.
 *   - The canonical license block inside a neutral callout panel.
 *   - Page footer with document code, version, confidentiality stamp, and page
 *     numbers.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.6.1
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  NumberFormat,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';

import {
  BRAND_COLORS,
  BRAND_FONTS,
  BRAND_FOOTER_TAGLINE,
  CONFIDENTIALITY_NOTICE,
  FONT_SIZES_HALF_PT,
  PAGE_MARGINS_TWIPS,
  riskTierColor,
} from './styles';
import { LICENSE_HEADING, LICENSE_PARAGRAPHS } from './licenseBlock';

export interface ExportMetadata {
  documentCode: string;
  /** Semantic version, e.g. "1.0.0". Default "1.0.0". */
  version?: string;
  /** Override generation date (ISO date string). Default = now. */
  generatedAt?: string;
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;
const FULL_WIDTH = { size: 100, type: WidthType.PERCENTAGE } as const;

/**
 * Build the .docx and return it as a Node Buffer. Pure: no I/O outside
 * `Packer.toBuffer`.
 */
export async function exportToWord(
  doc: GovernanceDocumentOutput,
  metadata: ExportMetadata,
): Promise<Buffer> {
  const version = metadata.version ?? '1.0.0';
  const generatedAt = metadata.generatedAt
    ? new Date(metadata.generatedAt)
    : new Date();

  const children: (Paragraph | Table)[] = [];
  children.push(coverBanner(doc));
  children.push(spacer(120));
  children.push(metadataPanel(doc, metadata.documentCode, version, generatedAt));
  children.push(spacer(160));
  pushSections(children, doc);
  pushFrameworkCitations(children, doc);
  pushLicense(children);

  const document = new Document({
    creator: 'Govi (GovSecure)',
    title: doc.title,
    description: `Generated GovSecure ${doc.documentType} — ${metadata.documentCode}`,
    sections: [
      {
        properties: { page: { margin: PAGE_MARGINS_TWIPS } },
        children,
        footers: { default: brandedFooter(metadata.documentCode, version) },
      },
    ],
    numbering: {
      config: [
        {
          reference: 'govsecure-numbering',
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
  });

  return Buffer.from(await Packer.toBuffer(document));
}

// ─── Cover + metadata ─────────────────────────────────────────────────────────

function coverBanner(doc: GovernanceDocumentOutput): Table {
  const lines: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: documentTypeLabel(doc).toUpperCase(),
          font: BRAND_FONTS.body,
          size: 18,
          bold: true,
          color: 'D9F2E5',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: doc.useCaseName ? 60 : 0 },
      children: [
        new TextRun({
          text: doc.title,
          font: BRAND_FONTS.heading,
          size: FONT_SIZES_HALF_PT.title,
          bold: true,
          color: BRAND_COLORS.white,
        }),
      ],
    }),
  ];

  if (doc.useCaseName) {
    lines.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Prepared for: ${doc.useCaseName}`,
            font: BRAND_FONTS.body,
            size: 22,
            color: 'D9F2E5',
          }),
        ],
      }),
    );
  }

  return new Table({
    width: FULL_WIDTH,
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: 'auto', fill: BRAND_COLORS.banner },
            margins: { top: 300, bottom: 300, left: 320, right: 320 },
            children: lines,
          }),
        ],
      }),
    ],
  });
}

function metadataPanel(
  doc: GovernanceDocumentOutput,
  documentCode: string,
  version: string,
  generatedAt: Date,
): Table {
  const rows: { label: string; value: string; color?: string; mono?: boolean }[] = [
    { label: 'Document Code', value: documentCode, mono: true, color: BRAND_COLORS.accentDim },
    { label: 'Risk Tier', value: doc.riskTier, color: riskTierColor(doc.riskTier) },
    { label: 'Version', value: version },
    { label: 'Generated', value: generatedAt.toISOString().slice(0, 10) },
    { label: 'Review Cycle', value: doc.reviewCycle },
  ];

  const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: BRAND_COLORS.panelBorder } as const;

  return new Table({
    width: FULL_WIDTH,
    borders: {
      top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder,
      insideHorizontal: thinBorder, insideVertical: NO_BORDER,
    },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: 'auto', fill: BRAND_COLORS.panel },
              margins: { top: 60, bottom: 60, left: 200, right: 120 },
              width: { size: 34, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: r.label.toUpperCase(),
                      font: BRAND_FONTS.body,
                      size: 16,
                      bold: true,
                      color: BRAND_COLORS.textMuted,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: 'auto', fill: BRAND_COLORS.panel },
              margins: { top: 60, bottom: 60, left: 120, right: 200 },
              width: { size: 66, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: r.value,
                      font: r.mono ? BRAND_FONTS.mono : BRAND_FONTS.body,
                      size: FONT_SIZES_HALF_PT.body,
                      bold: !r.mono,
                      color: r.color ?? BRAND_COLORS.textPrimary,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

// ─── Body ──────────────────────────────────────────────────────────────────

function pushSections(children: (Paragraph | Table)[], doc: GovernanceDocumentOutput): void {
  doc.sections.forEach((section, idx) => {
    children.push(sectionBand(`${idx + 1}.  ${section.heading}`));

    if (section.content) {
      for (const para of splitParagraphs(section.content)) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: para,
                font: BRAND_FONTS.body,
                size: FONT_SIZES_HALF_PT.body,
                color: BRAND_COLORS.textPrimary,
              }),
            ],
          }),
        );
      }
    }

    if (section.tables && section.tables.length > 0) {
      children.push(buildTable(section.tables));
    }

    if (section.checklistItems && section.checklistItems.length > 0) {
      for (const item of section.checklistItems) {
        children.push(
          new Paragraph({
            spacing: { before: 50, after: 50 },
            indent: { left: 180 },
            children: [
              new TextRun({
                text: item.complete ? '☒  ' : '☐  ',
                font: BRAND_FONTS.body,
                size: FONT_SIZES_HALF_PT.body,
                bold: true,
                color: item.complete ? BRAND_COLORS.accent : BRAND_COLORS.textMuted,
              }),
              new TextRun({
                text: item.text,
                font: BRAND_FONTS.body,
                size: FONT_SIZES_HALF_PT.body,
                color: BRAND_COLORS.textPrimary,
              }),
            ],
          }),
        );
      }
    }
  });
}

/**
 * Render a 2-D string matrix as a branded `docx` Table. The first row is
 * styled as a header (bold text, light accent shading). Defensive against
 * ragged rows: pads short rows to the widest row's column count.
 */
function buildTable(rows: string[][]): Table {
  const colCount = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((row) =>
    Array.from({ length: colCount }, (_, i) => (row[i] ?? '').trim()),
  );
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: BRAND_COLORS.divider };
  const cellBorders = {
    top: cellBorder,
    bottom: cellBorder,
    left: cellBorder,
    right: cellBorder,
  };

  const tableRows = padded.map((row, rowIdx) => {
    const isHeader = rowIdx === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: row.map(
        (cell) =>
          new TableCell({
            borders: cellBorders,
            shading: isHeader
              ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EAF7EE' }
              : undefined,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: cell,
                    bold: isHeader,
                    font: BRAND_FONTS.body,
                    size: FONT_SIZES_HALF_PT.body,
                    color: BRAND_COLORS.textPrimary,
                  }),
                ],
              }),
            ],
          }),
      ),
    });
  });

  return new Table({
    width: FULL_WIDTH,
    rows: tableRows,
  });
}

/** Shaded section band with an accent left spine — the colourful heading style. */
function sectionBand(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    shading: { type: ShadingType.SOLID, color: 'auto', fill: BRAND_COLORS.accentSoft },
    border: {
      left: { style: BorderStyle.SINGLE, size: 20, color: BRAND_COLORS.accent, space: 8 },
    },
    children: [
      new TextRun({
        text,
        font: BRAND_FONTS.heading,
        size: FONT_SIZES_HALF_PT.h1,
        bold: true,
        color: BRAND_COLORS.accentDim,
      }),
    ],
  });
}

function pushFrameworkCitations(
  children: (Paragraph | Table)[],
  doc: GovernanceDocumentOutput,
): void {
  if (!doc.frameworkCitations || doc.frameworkCitations.length === 0) return;

  children.push(sectionBand('Framework References'));

  for (const c of doc.frameworkCitations) {
    children.push(
      new Paragraph({
        spacing: { before: 50, after: 50 },
        bullet: { level: 0 },
        children: [
          new TextRun({
            text: `${c.framework} — ${c.reference}: `,
            bold: true,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.body,
            color: BRAND_COLORS.accentDim,
          }),
          new TextRun({
            text: c.description,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.body,
            color: BRAND_COLORS.textPrimary,
          }),
        ],
      }),
    );
  }
}

function pushLicense(children: (Paragraph | Table)[]): void {
  const inner: Paragraph[] = [
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: LICENSE_HEADING,
          font: BRAND_FONTS.heading,
          size: FONT_SIZES_HALF_PT.h3,
          bold: true,
          color: BRAND_COLORS.textPrimary,
        }),
      ],
    }),
  ];

  for (const p of LICENSE_PARAGRAPHS) {
    inner.push(
      new Paragraph({
        spacing: { before: 70, after: 70 },
        children: [
          new TextRun({
            text: `${p.heading}. `,
            bold: true,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.footer,
            color: BRAND_COLORS.textPrimary,
          }),
          new TextRun({
            text: p.body,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.footer,
            color: BRAND_COLORS.textMuted,
          }),
        ],
      }),
    );
  }

  const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: BRAND_COLORS.panelBorder } as const;
  children.push(spacer(360));
  children.push(
    new Table({
      width: FULL_WIDTH,
      borders: {
        top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder,
        insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: 'auto', fill: BRAND_COLORS.panel },
              margins: { top: 220, bottom: 220, left: 280, right: 280 },
              children: inner,
            }),
          ],
        }),
      ],
    }),
  );
}

function brandedFooter(documentCode: string, version: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${documentCode} · v${version} · ${CONFIDENTIALITY_NOTICE} · ${BRAND_FOOTER_TAGLINE} · `,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.footer,
            color: BRAND_COLORS.textMuted,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.footer,
            color: BRAND_COLORS.textMuted,
          }),
        ],
      }),
    ],
  });
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function spacer(after: number): Paragraph {
  return new Paragraph({ spacing: { after }, children: [] });
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Human label for the document type, derived from the type slug. */
function documentTypeLabel(doc: GovernanceDocumentOutput): string {
  const slug = doc.documentType ?? '';
  const known: Record<string, string> = {
    'govsecure-aup': 'Acceptable Use Policy',
    'govsecure-governance-policy': 'AI Governance Policy',
    'govsecure-checklist-intake': 'Intake Checklist',
    dpia: 'Data Protection Impact Assessment',
    'monitoring-plan': 'Monitoring Plan',
  };
  if (known[slug]) return known[slug];
  if (slug) {
    return slug
      .replace(/^govsecure-/, '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return 'Governance Document';
}
