/**
 * Branded GovSecure DOCX exporter — Phase 2.6.1.
 *
 * Renders a `GovernanceDocumentOutput` as a .docx file matching the visual
 * style of the licensed GovSecure templates. Use this in preference to the
 * generic `markdownToDocx` helper for any GovSecure-licensed document type.
 *
 * Key features:
 *   - Title page with the document code, risk tier, generation date, and
 *     review cycle.
 *   - Heading 1–4 styles using the GovSecure brand palette.
 *   - Page footer with document code, version, "Confidential — Internal
 *     Use Only", and page numbers.
 *   - Required license / disclaimer block as the final section.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.6.1
 */

import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  NumberFormat,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';

import {
  BRAND_COLORS,
  BRAND_FONTS,
  BRAND_FOOTER_TAGLINE,
  CONFIDENTIALITY_NOTICE,
  FONT_SIZES_HALF_PT,
  PAGE_MARGINS_TWIPS,
} from './styles';
import { LICENSE_HEADING, LICENSE_PARAGRAPHS } from './licenseBlock';

export interface ExportMetadata {
  documentCode: string;
  /** Semantic version, e.g. "1.0.0". Default "1.0.0". */
  version?: string;
  /** Override generation date (ISO date string). Default = now. */
  generatedAt?: string;
}

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

  const children: Paragraph[] = [];
  pushTitle(children, doc, metadata.documentCode, version, generatedAt);
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

// ─── Builders ──────────────────────────────────────────────────────────────

function pushTitle(
  children: Paragraph[],
  doc: GovernanceDocumentOutput,
  documentCode: string,
  version: string,
  generatedAt: Date,
): void {
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: doc.title,
          font: BRAND_FONTS.heading,
          size: FONT_SIZES_HALF_PT.title,
          bold: true,
          color: BRAND_COLORS.textPrimary,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: documentCode,
          font: BRAND_FONTS.mono,
          size: FONT_SIZES_HALF_PT.body,
          color: BRAND_COLORS.accent,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        muted(`Risk Tier: ${doc.riskTier}`),
        muted('  ·  '),
        muted(`Version ${version}`),
        muted('  ·  '),
        muted(`Generated ${generatedAt.toISOString().slice(0, 10)}`),
        muted('  ·  '),
        muted(`Review cycle: ${doc.reviewCycle}`),
      ],
    }),
  );
}

function pushSections(children: Paragraph[], doc: GovernanceDocumentOutput): void {
  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        spacing: { before: 320, after: 100 },
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: section.heading,
            font: BRAND_FONTS.heading,
            size: FONT_SIZES_HALF_PT.h1,
            color: BRAND_COLORS.accent,
            bold: true,
          }),
        ],
      }),
    );

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

    if (section.checklistItems && section.checklistItems.length > 0) {
      for (const item of section.checklistItems) {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: `${item.complete ? '☒ ' : '☐ '}${item.text}`,
                font: BRAND_FONTS.body,
                size: FONT_SIZES_HALF_PT.body,
                color: BRAND_COLORS.textPrimary,
              }),
            ],
          }),
        );
      }
    }
  }
}

function pushFrameworkCitations(
  children: Paragraph[],
  doc: GovernanceDocumentOutput,
): void {
  if (!doc.frameworkCitations || doc.frameworkCitations.length === 0) return;

  children.push(
    new Paragraph({
      spacing: { before: 320, after: 100 },
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: 'Framework References',
          font: BRAND_FONTS.heading,
          size: FONT_SIZES_HALF_PT.h2,
          color: BRAND_COLORS.accentDim,
          bold: true,
        }),
      ],
    }),
  );

  for (const c of doc.frameworkCitations) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        bullet: { level: 0 },
        children: [
          new TextRun({
            text: `${c.framework} — ${c.reference}: `,
            bold: true,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.body,
            color: BRAND_COLORS.textPrimary,
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

function pushLicense(children: Paragraph[]): void {
  children.push(
    new Paragraph({
      spacing: { before: 480, after: 120 },
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: LICENSE_HEADING,
          font: BRAND_FONTS.heading,
          size: FONT_SIZES_HALF_PT.h2,
          color: BRAND_COLORS.textMuted,
          bold: true,
        }),
      ],
    }),
  );

  for (const p of LICENSE_PARAGRAPHS) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: `${p.heading}. `,
            bold: true,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.body,
            color: BRAND_COLORS.textPrimary,
          }),
          new TextRun({
            text: p.body,
            font: BRAND_FONTS.body,
            size: FONT_SIZES_HALF_PT.body,
            color: BRAND_COLORS.textPrimary,
          }),
        ],
      }),
    );
  }
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

function muted(text: string): TextRun {
  return new TextRun({
    text,
    font: BRAND_FONTS.body,
    size: FONT_SIZES_HALF_PT.body,
    color: BRAND_COLORS.textMuted,
    italics: true,
  });
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
