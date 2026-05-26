/**
 * Branded GovSecure PDF exporter — Phase 2.6.2.
 *
 * Renders a `GovernanceDocumentOutput` as a PDF that mirrors the .docx
 * exporter (`govSecureWordExporter.ts`) — same heading styles, same footer
 * with document code + version + confidentiality notice, same license block.
 *
 * Uses `jspdf` (already in dependencies). Returns a Node Buffer so the
 * download route can stream it directly.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.6.2
 */

import { jsPDF } from 'jspdf';

import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';

import {
  BRAND_COLORS,
  BRAND_FOOTER_TAGLINE,
  CONFIDENTIALITY_NOTICE,
  FONT_SIZES_PT,
} from './styles';
import { LICENSE_HEADING, LICENSE_PARAGRAPHS } from './licenseBlock';

export interface ExportMetadata {
  documentCode: string;
  version?: string;
  generatedAt?: string;
}

/** Shared layout constants. mm units. */
const PAGE_MARGINS_MM = { top: 25, right: 20, bottom: 25, left: 20 };

const COLORS_RGB = {
  textPrimary: hexToRgb(BRAND_COLORS.textPrimary),
  textMuted: hexToRgb(BRAND_COLORS.textMuted),
  accent: hexToRgb(BRAND_COLORS.accent),
  accentDim: hexToRgb(BRAND_COLORS.accentDim),
  divider: hexToRgb(BRAND_COLORS.divider),
};

/** Generate the branded PDF. */
export async function exportToPdf(
  doc: GovernanceDocumentOutput,
  metadata: ExportMetadata,
): Promise<Buffer> {
  const version = metadata.version ?? '1.0.0';
  const generatedAt = metadata.generatedAt
    ? new Date(metadata.generatedAt)
    : new Date();

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGINS_MM.left - PAGE_MARGINS_MM.right;

  let y = PAGE_MARGINS_MM.top;
  let pageNum = 1;

  const drawFooter = (): void => {
    const footerY = pageHeight - 12;
    pdf.setFontSize(FONT_SIZES_PT.footer);
    pdf.setFont('helvetica', 'normal');
    setColor(pdf, COLORS_RGB.textMuted);
    const left = `${metadata.documentCode}  ·  v${version}  ·  ${CONFIDENTIALITY_NOTICE}`;
    pdf.text(left, PAGE_MARGINS_MM.left, footerY);
    pdf.text(`${BRAND_FOOTER_TAGLINE}  ·  Page ${pageNum}`, pageWidth - PAGE_MARGINS_MM.right, footerY, { align: 'right' });
    setColor(pdf, COLORS_RGB.textPrimary);
  };

  /**
   * Reserve vertical space; page-break if it won't fit. Returns the current
   * y cursor so callers (especially `drawTable`, which runs inside a helper
   * that does not see this closure's `y`) can observe page resets.
   */
  const ensureSpace = (needed: number): number => {
    if (y + needed > pageHeight - PAGE_MARGINS_MM.bottom) {
      drawFooter();
      pdf.addPage();
      pageNum += 1;
      y = PAGE_MARGINS_MM.top;
    }
    return y;
  };

  // ── Title page ────────────────────────────────────────────────────────
  pdf.setFontSize(FONT_SIZES_PT.title);
  pdf.setFont('helvetica', 'bold');
  setColor(pdf, COLORS_RGB.textPrimary);
  pdf.text(doc.title, pageWidth / 2, y + 10, { align: 'center' });
  y += 18;

  pdf.setFontSize(FONT_SIZES_PT.body);
  pdf.setFont('courier', 'normal');
  setColor(pdf, COLORS_RGB.accent);
  pdf.text(metadata.documentCode, pageWidth / 2, y, { align: 'center' });
  y += 6;

  pdf.setFont('helvetica', 'italic');
  setColor(pdf, COLORS_RGB.textMuted);
  pdf.setFontSize(FONT_SIZES_PT.body);
  const meta = `Risk Tier: ${doc.riskTier}  ·  Version ${version}  ·  Generated ${generatedAt.toISOString().slice(0, 10)}  ·  Review cycle: ${doc.reviewCycle}`;
  pdf.text(meta, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Divider rule under the title block
  setDrawColor(pdf, COLORS_RGB.divider);
  pdf.setLineWidth(0.3);
  pdf.line(PAGE_MARGINS_MM.left, y, pageWidth - PAGE_MARGINS_MM.right, y);
  y += 6;

  pdf.setFont('helvetica', 'normal');
  setColor(pdf, COLORS_RGB.textPrimary);

  // ── Body sections ─────────────────────────────────────────────────────
  for (const section of doc.sections) {
    ensureSpace(14);
    y += 4;
    pdf.setFontSize(FONT_SIZES_PT.h1);
    pdf.setFont('helvetica', 'bold');
    setColor(pdf, COLORS_RGB.accent);
    pdf.text(section.heading, PAGE_MARGINS_MM.left, y);
    y += 8;

    pdf.setFont('helvetica', 'normal');
    setColor(pdf, COLORS_RGB.textPrimary);
    pdf.setFontSize(FONT_SIZES_PT.body);

    if (section.content) {
      const paragraphs = splitParagraphs(section.content);
      for (const para of paragraphs) {
        const wrapped = pdf.splitTextToSize(para, contentWidth);
        ensureSpace(wrapped.length * 5 + 3);
        pdf.text(wrapped, PAGE_MARGINS_MM.left, y);
        y += wrapped.length * 5 + 3;
      }
    }

    if (section.tables && section.tables.length > 0) {
      y = drawTable(pdf, section.tables, PAGE_MARGINS_MM.left, y, contentWidth, ensureSpace);
      y += 3;
    }

    if (section.checklistItems && section.checklistItems.length > 0) {
      for (const item of section.checklistItems) {
        const text = `${item.complete ? '☒ ' : '☐ '}${item.text}`;
        const wrapped = pdf.splitTextToSize(text, contentWidth - 4);
        ensureSpace(wrapped.length * 5 + 1);
        pdf.text(wrapped, PAGE_MARGINS_MM.left + 4, y);
        y += wrapped.length * 5 + 1;
      }
    }
  }

  // ── Framework citations ───────────────────────────────────────────────
  if (doc.frameworkCitations && doc.frameworkCitations.length > 0) {
    ensureSpace(14);
    y += 6;
    pdf.setFontSize(FONT_SIZES_PT.h2);
    pdf.setFont('helvetica', 'bold');
    setColor(pdf, COLORS_RGB.accentDim);
    pdf.text('Framework References', PAGE_MARGINS_MM.left, y);
    y += 7;

    pdf.setFontSize(FONT_SIZES_PT.body);
    pdf.setFont('helvetica', 'normal');
    setColor(pdf, COLORS_RGB.textPrimary);

    for (const c of doc.frameworkCitations) {
      const text = `• ${c.framework} — ${c.reference}: ${c.description}`;
      const wrapped = pdf.splitTextToSize(text, contentWidth);
      ensureSpace(wrapped.length * 5 + 2);
      pdf.text(wrapped, PAGE_MARGINS_MM.left, y);
      y += wrapped.length * 5 + 2;
    }
  }

  // ── License block ─────────────────────────────────────────────────────
  ensureSpace(20);
  y += 8;
  pdf.setFontSize(FONT_SIZES_PT.h2);
  pdf.setFont('helvetica', 'bold');
  setColor(pdf, COLORS_RGB.textMuted);
  pdf.text(LICENSE_HEADING, PAGE_MARGINS_MM.left, y);
  y += 7;

  pdf.setFontSize(FONT_SIZES_PT.body);
  pdf.setFont('helvetica', 'normal');
  setColor(pdf, COLORS_RGB.textPrimary);

  for (const p of LICENSE_PARAGRAPHS) {
    const text = `${p.heading}. ${p.body}`;
    const wrapped = pdf.splitTextToSize(text, contentWidth);
    ensureSpace(wrapped.length * 5 + 3);
    pdf.text(wrapped, PAGE_MARGINS_MM.left, y);
    y += wrapped.length * 5 + 3;
  }

  drawFooter();
  return Buffer.from(pdf.output('arraybuffer'));
}

// ─── helpers ───────────────────────────────────────────────────────────────

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function setColor(pdf: jsPDF, c: RGB): void {
  pdf.setTextColor(c.r, c.g, c.b);
}

function setDrawColor(pdf: jsPDF, c: RGB): void {
  pdf.setDrawColor(c.r, c.g, c.b);
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Render a 2-D string matrix as a branded table inside the current jsPDF
 * document. The first row is treated as a header (bold text, light accent
 * fill). Wraps long cells. Calls `ensureSpace` before each row so a long
 * table flows cleanly across page breaks. Returns the new y cursor.
 */
function drawTable(
  pdf: jsPDF,
  rows: string[][],
  x: number,
  yStart: number,
  width: number,
  ensureSpace: (needed: number) => number,
): number {
  if (!rows.length) return yStart;
  const colCount = Math.max(...rows.map((r) => r.length));
  if (colCount === 0) return yStart;

  const padded = rows.map((row) =>
    Array.from({ length: colCount }, (_, i) => (row[i] ?? '').trim()),
  );
  const colWidth = width / colCount;
  const cellPad = 1.5;
  const lineHeight = 4.5;

  // Pre-wrap every cell so we know each row's height before drawing.
  const wrappedRows = padded.map((row) =>
    row.map((cell) => pdf.splitTextToSize(cell || ' ', colWidth - 2 * cellPad) as string[]),
  );
  const rowHeights = wrappedRows.map((row) => {
    const lines = Math.max(...row.map((cell) => cell.length));
    return lines * lineHeight + cellPad * 2;
  });

  let y = yStart;
  for (let r = 0; r < wrappedRows.length; r++) {
    const rowHeight = rowHeights[r];
    // ensureSpace may page-break and reset the outer y; we adopt the returned
    // value so the next row draws inside the new page.
    y = ensureSpace(rowHeight);

    const isHeader = r === 0;

    if (isHeader) {
      pdf.setFillColor(234, 247, 238); // matches DOCX header fill EAF7EE
      pdf.rect(x, y, width, rowHeight, 'F');
    }

    setDrawColor(pdf, COLORS_RGB.divider);
    pdf.setLineWidth(0.2);
    pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
    pdf.setFontSize(FONT_SIZES_PT.body - 1);
    setColor(pdf, COLORS_RGB.textPrimary);

    for (let c = 0; c < colCount; c++) {
      const cellX = x + c * colWidth;
      pdf.rect(cellX, y, colWidth, rowHeight); // border
      const lines = wrappedRows[r][c];
      pdf.text(lines, cellX + cellPad, y + cellPad + lineHeight - 1);
    }

    y += rowHeight;
  }

  // Reset font for whatever the caller draws next.
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(FONT_SIZES_PT.body);
  setColor(pdf, COLORS_RGB.textPrimary);

  return y;
}
