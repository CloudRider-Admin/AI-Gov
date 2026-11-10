/**
 * Branded GovSecure PDF exporter — professional report layout.
 *
 * Renders a `GovernanceDocumentOutput` (Risk Assessment Reports, governance
 * artefacts, risk-tiering documents, policies, DPIAs, …) as a polished,
 * print-ready PDF:
 *
 *   • Designed cover page — brand wordmark, document title, colour-coded risk
 *     tier badge, metadata panel, document code, and confidentiality stamp.
 *   • Running header band + page-numbered footer ("Page X of Y") on body pages.
 *   • Numbered section headings with accent rules, checkbox checklists, and a
 *     framework-citations panel.
 *   • The canonical GovSecure license block.
 *
 * Mirrors the .docx exporter (`govSecureWordExporter.ts`) for document code,
 * version, and confidentiality parity. Uses `jspdf`. Returns a Node Buffer so
 * the download route can stream it directly.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.6.2
 */

import { jsPDF } from 'jspdf';

import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';

import {
  BRAND_COLORS,
  BRAND_FOOTER_TAGLINE,
  CONFIDENTIALITY_NOTICE,
} from './styles';
import { LICENSE_HEADING, LICENSE_PARAGRAPHS } from './licenseBlock';

export interface ExportMetadata {
  documentCode: string;
  version?: string;
  generatedAt?: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

// ─── Layout constants (mm) ──────────────────────────────────────────────────

const MARGIN = { top: 28, right: 18, bottom: 22, left: 18 } as const;
const ACCENT_BAR_W = 4; // left spine on body pages

// ─── Palette ────────────────────────────────────────────────────────────────

const COLORS = {
  text: hexToRgb(BRAND_COLORS.textPrimary),
  muted: hexToRgb(BRAND_COLORS.textMuted),
  accent: hexToRgb(BRAND_COLORS.accent),
  accentDim: hexToRgb(BRAND_COLORS.accentDim),
  divider: hexToRgb(BRAND_COLORS.divider),
  white: { r: 255, g: 255, b: 255 },
  coverBg: hexToRgb('0B1A12'), // deep governance-green for the cover
  coverDot: hexToRgb('1F4A36'),
  panelBg: hexToRgb('F4F7F5'),
  panelBorder: hexToRgb('DCE4DF'),
} as const;

/** Risk-tier colour coding — used for the cover badge and header chip. */
const RISK_TIER_COLORS: Record<string, RGB> = {
  Low: hexToRgb('1F9D63'),
  Medium: hexToRgb('D99A0B'),
  High: hexToRgb('E1670E'),
  Critical: hexToRgb('D7263D'),
};

function riskColor(tier: string): RGB {
  return RISK_TIER_COLORS[tier] ?? COLORS.accent;
}

// ─── Entry point ────────────────────────────────────────────────────────────

/** Generate the branded PDF. */
export async function exportToPdf(
  doc: GovernanceDocumentOutput,
  metadata: ExportMetadata,
): Promise<Buffer> {
  const version = metadata.version ?? '1.0.0';
  const generatedAt = metadata.generatedAt ? new Date(metadata.generatedAt) : new Date();

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN.left - MARGIN.right;
  const totalPagesAlias = '{tp}'; // replaced via putTotalPages at the end

  // ── Cover page ──────────────────────────────────────────────────────────
  drawCover(pdf, doc, metadata, { version, generatedAt, pageWidth, pageHeight });

  // ── Body pages ────────────────────────────────────────────────────────────
  pdf.addPage();
  const runningTitle = truncate(doc.title, 64);
  let y: number = MARGIN.top;

  const drawChrome = (): void => {
    drawHeaderBand(pdf, { pageWidth, runningTitle, riskTier: doc.riskTier });
    drawAccentSpine(pdf, pageHeight);
    drawFooter(pdf, {
      pageWidth,
      pageHeight,
      documentCode: metadata.documentCode,
      version,
      totalPagesAlias,
    });
  };

  // Paint chrome on the first body page, then on every page break.
  drawChrome();

  /**
   * Reserve vertical space; page-break if it won't fit. Returns the current
   * y cursor so callers (especially `drawTable`, which runs inside a helper
   * that does not see this closure's `y`) can observe page resets.
   */
  const ensureSpace = (needed: number): number => {
    if (y + needed > pageHeight - MARGIN.bottom) {
      pdf.addPage();
      y = MARGIN.top;
      drawChrome();
    }
    return y;
  };

  // ── Sections ────────────────────────────────────────────────────────────
  doc.sections.forEach((section, idx) => {
    ensureSpace(16);
    y = drawSectionHeading(pdf, `${idx + 1}. ${section.heading}`, y, contentWidth);

    setFont(pdf, 'helvetica', 'normal', 10.5, COLORS.text);

    if (section.content) {
      for (const para of splitParagraphs(section.content)) {
        const wrapped = pdf.splitTextToSize(para, contentWidth);
        ensureSpace(wrapped.length * 5 + 3);
        pdf.text(wrapped, MARGIN.left, y);
        y += wrapped.length * 5 + 3.5;
      }
    }

    if (section.tables && section.tables.length > 0) {
      y = drawTable(pdf, section.tables, MARGIN.left, y, contentWidth, ensureSpace);
      y += 3;
    }

    if (section.checklistItems && section.checklistItems.length > 0) {
      y += 1;
      for (const item of section.checklistItems) {
        const wrapped = pdf.splitTextToSize(item.text, contentWidth - 8);
        ensureSpace(Math.max(wrapped.length * 5, 5) + 2);
        drawCheckbox(pdf, MARGIN.left, y - 3.2, item.complete);
        setFont(pdf, 'helvetica', 'normal', 10.5, COLORS.text);
        pdf.text(wrapped, MARGIN.left + 7, y);
        y += Math.max(wrapped.length * 5, 5) + 2.2;
      }
    }

    y += 3;
  });

  // ── Framework citations panel ─────────────────────────────────────────────
  if (doc.frameworkCitations && doc.frameworkCitations.length > 0) {
    ensureSpace(20);
    y = drawSectionHeading(pdf, 'Framework References', y, contentWidth);

    for (const c of doc.frameworkCitations) {
      const body = `${c.reference} — ${c.description}`;
      const wrapped = pdf.splitTextToSize(body, contentWidth - 4);
      const blockH = wrapped.length * 4.6 + 7;
      ensureSpace(blockH + 3);

      // Framework tag
      setFont(pdf, 'helvetica', 'bold', 8.5, COLORS.white);
      const tagW = pdf.getTextWidth(c.framework) + 5;
      setFill(pdf, COLORS.accentDim);
      pdf.roundedRect(MARGIN.left, y - 3.6, tagW, 5.4, 1, 1, 'F');
      pdf.text(c.framework, MARGIN.left + 2.5, y);

      // Reference + description
      setFont(pdf, 'helvetica', 'normal', 9.5, COLORS.text);
      pdf.text(wrapped, MARGIN.left, y + 5);
      y += blockH + 2;
    }
    y += 2;
  }

  // ── License block ─────────────────────────────────────────────────────────
  ensureSpace(24);
  y += 2;
  y = drawSectionHeading(pdf, LICENSE_HEADING, y, contentWidth, COLORS.muted);

  for (const p of LICENSE_PARAGRAPHS) {
    const wrapped = pdf.splitTextToSize(p.body, contentWidth - 2);
    ensureSpace(wrapped.length * 4.4 + 6);
    setFont(pdf, 'helvetica', 'bold', 9.5, COLORS.text);
    pdf.text(`${p.heading}.`, MARGIN.left, y);
    setFont(pdf, 'helvetica', 'normal', 9.5, COLORS.muted);
    pdf.text(wrapped, MARGIN.left, y + 4.4);
    y += wrapped.length * 4.4 + 5.5;
  }

  // Stamp total page count into every "Page X of {tp}".
  if (typeof (pdf as unknown as { putTotalPages?: unknown }).putTotalPages === 'function') {
    pdf.putTotalPages(totalPagesAlias);
  }

  return Buffer.from(pdf.output('arraybuffer'));
}

// ─── Cover page ─────────────────────────────────────────────────────────────

function drawCover(
  pdf: jsPDF,
  doc: GovernanceDocumentOutput,
  metadata: ExportMetadata,
  ctx: { version: string; generatedAt: Date; pageWidth: number; pageHeight: number },
): void {
  const { pageWidth, pageHeight, version, generatedAt } = ctx;

  // Full-bleed dark cover background.
  setFill(pdf, COLORS.coverBg);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative dotted globe — a subtle nod to the worldwide reach of AI
  // governance, echoing the home-page hero. Sits in the top-right corner.
  drawCoverGlobe(pdf, pageWidth - 14, 20, 34);

  // Accent rule near the top.
  setFill(pdf, COLORS.accent);
  pdf.rect(MARGIN.left, 30, 22, 1.4, 'F');

  // Brand wordmark.
  setFont(pdf, 'helvetica', 'bold', 15, COLORS.white);
  pdf.text('GovSecure', MARGIN.left, 26);
  setFont(pdf, 'helvetica', 'normal', 9, COLORS.accent);
  pdf.text('AI GOVERNANCE', MARGIN.left + 0.3, 39, { charSpace: 0.6 });

  // Document-type eyebrow.
  setFont(pdf, 'helvetica', 'bold', 9.5, { r: 160, g: 196, b: 178 });
  pdf.text(documentTypeLabel(doc).toUpperCase(), MARGIN.left, 96, { charSpace: 0.8 });

  // Title — large, wrapped.
  setFont(pdf, 'helvetica', 'bold', 30, COLORS.white);
  const titleLines = pdf.splitTextToSize(doc.title, pageWidth - MARGIN.left - MARGIN.right - 6);
  pdf.text(titleLines, MARGIN.left, 110);
  let y = 110 + titleLines.length * 11 + 6;

  // Use-case subtitle.
  if (doc.useCaseName) {
    setFont(pdf, 'helvetica', 'normal', 12, { r: 170, g: 200, b: 184 });
    pdf.text(`Prepared for: ${doc.useCaseName}`, MARGIN.left, y);
    y += 12;
  }

  // Risk-tier badge.
  y += 4;
  drawRiskBadge(pdf, MARGIN.left, y, doc.riskTier);
  y += 22;

  // Metadata panel.
  drawCoverMeta(pdf, MARGIN.left, y, pageWidth - MARGIN.left - MARGIN.right, {
    documentCode: metadata.documentCode,
    version,
    generated: generatedAt.toISOString().slice(0, 10),
    reviewCycle: doc.reviewCycle,
  });

  // Confidentiality footer on the cover.
  setFill(pdf, COLORS.accent);
  pdf.rect(MARGIN.left, pageHeight - 24, 12, 0.8, 'F');
  setFont(pdf, 'helvetica', 'normal', 8.5, { r: 150, g: 184, b: 166 });
  pdf.text(CONFIDENTIALITY_NOTICE, MARGIN.left, pageHeight - 18);
  pdf.text(BRAND_FOOTER_TAGLINE, pageWidth - MARGIN.right, pageHeight - 18, { align: 'right' });
}

/** A clean dotted globe motif: outer ring + equator + meridian ellipses. */
function drawCoverGlobe(pdf: jsPDF, cx: number, cy: number, r: number): void {
  const dot = (x: number, y: number, s = 0.5) => pdf.circle(x, y, s, 'F');
  const dottedEllipse = (a: number, b: number, n: number, s = 0.45) => {
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      dot(cx + Math.cos(t) * a, cy + Math.sin(t) * b, s);
    }
  };
  setFill(pdf, COLORS.accent);
  dottedEllipse(r, r, 72, 0.55); // outer ring
  setFill(pdf, COLORS.coverDot);
  dottedEllipse(r, r * 0.34, 56); // equator
  dottedEllipse(r * 0.5, r, 56); // central meridian
  dottedEllipse(r * 0.85, r, 56); // outer meridian
  dottedEllipse(r, r * 0.7, 56); // upper latitude
}

function drawRiskBadge(pdf: jsPDF, x: number, y: number, tier: string): void {
  const c = riskColor(tier);
  const label = `RISK TIER: ${tier.toUpperCase()}`;
  setFont(pdf, 'helvetica', 'bold', 10, COLORS.white);
  const w = pdf.getTextWidth(label) + 12;
  const h = 9;
  setFill(pdf, c);
  pdf.roundedRect(x, y, w, h, 2, 2, 'F');
  // small marker dot
  setFill(pdf, COLORS.white);
  pdf.circle(x + 5, y + h / 2, 1.4, 'F');
  setFont(pdf, 'helvetica', 'bold', 10, COLORS.white);
  pdf.text(label, x + 9, y + h / 2 + 1.4);
}

function drawCoverMeta(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  meta: { documentCode: string; version: string; generated: string; reviewCycle: string },
): void {
  const rows: [string, string][] = [
    ['Document Code', meta.documentCode],
    ['Version', meta.version],
    ['Generated', meta.generated],
    ['Review Cycle', meta.reviewCycle],
  ];
  const rowH = 8;
  const panelH = rows.length * rowH + 6;

  // translucent panel
  setFill(pdf, { r: 18, g: 38, b: 28 });
  pdf.roundedRect(x, y, w, panelH, 2, 2, 'F');
  pdf.setDrawColor(34, 70, 52);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, panelH, 2, 2, 'S');

  let ry = y + 8;
  rows.forEach(([k, v], i) => {
    setFont(pdf, 'helvetica', 'normal', 8.5, { r: 140, g: 176, b: 158 });
    pdf.text(k.toUpperCase(), x + 6, ry, { charSpace: 0.4 });
    const isCode = k === 'Document Code';
    setFont(pdf, isCode ? 'courier' : 'helvetica', isCode ? 'normal' : 'bold', 10, COLORS.white);
    pdf.text(v, x + w - 6, ry, { align: 'right' });
    if (i < rows.length - 1) {
      pdf.setDrawColor(30, 60, 45);
      pdf.line(x + 6, ry + 2.6, x + w - 6, ry + 2.6);
    }
    ry += rowH;
  });
}

// ─── Body chrome ────────────────────────────────────────────────────────────

function drawHeaderBand(
  pdf: jsPDF,
  ctx: { pageWidth: number; runningTitle: string; riskTier: string },
): void {
  const { pageWidth, runningTitle, riskTier } = ctx;

  setFont(pdf, 'helvetica', 'bold', 9, COLORS.accent);
  pdf.text('GovSecure', MARGIN.left, 14);
  setFont(pdf, 'helvetica', 'normal', 8.5, COLORS.muted);
  pdf.text(runningTitle, MARGIN.left + pdf.getTextWidth('GovSecure') + 4, 14);

  // Risk-tier chip, right-aligned.
  const chip = riskTier.toUpperCase();
  setFont(pdf, 'helvetica', 'bold', 7.5, COLORS.white);
  const chipW = pdf.getTextWidth(chip) + 6;
  const chipX = pageWidth - MARGIN.right - chipW;
  setFill(pdf, riskColor(riskTier));
  pdf.roundedRect(chipX, 9.5, chipW, 5.2, 1, 1, 'F');
  pdf.text(chip, chipX + 3, 13.2);

  // Divider under the band.
  pdf.setDrawColor(COLORS.divider.r, COLORS.divider.g, COLORS.divider.b);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN.left, 18, pageWidth - MARGIN.right, 18);
}

function drawAccentSpine(pdf: jsPDF, pageHeight: number): void {
  setFill(pdf, COLORS.accent);
  pdf.rect(0, 20, ACCENT_BAR_W, pageHeight - 40, 'F');
}

function drawFooter(
  pdf: jsPDF,
  ctx: {
    pageWidth: number;
    pageHeight: number;
    documentCode: string;
    version: string;
    totalPagesAlias: string;
  },
): void {
  const { pageWidth, pageHeight, documentCode, version, totalPagesAlias } = ctx;
  const footerY = pageHeight - 12;

  pdf.setDrawColor(COLORS.divider.r, COLORS.divider.g, COLORS.divider.b);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN.left, footerY - 4, pageWidth - MARGIN.right, footerY - 4);

  setFont(pdf, 'helvetica', 'normal', 8, COLORS.muted);
  pdf.text(`${documentCode}  ·  v${version}  ·  ${CONFIDENTIALITY_NOTICE}`, MARGIN.left, footerY);
  const pageNum = pdf.getNumberOfPages();
  pdf.text(
    `${BRAND_FOOTER_TAGLINE}  ·  Page ${pageNum} of ${totalPagesAlias}`,
    pageWidth - MARGIN.right,
    footerY,
    { align: 'right' },
  );
}

// ─── Content primitives ─────────────────────────────────────────────────────

function drawSectionHeading(
  pdf: jsPDF,
  text: string,
  y: number,
  contentWidth: number,
  color: RGB = COLORS.accent,
): number {
  let yy = y + 3;
  setFont(pdf, 'helvetica', 'bold', 13.5, color);
  const lines = pdf.splitTextToSize(text, contentWidth);
  pdf.text(lines, MARGIN.left, yy);
  yy += lines.length * 6 + 1.5;
  // accent underline rule
  pdf.setDrawColor(color.r, color.g, color.b);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN.left, yy, MARGIN.left + 16, yy);
  return yy + 5.5;
}

function drawCheckbox(pdf: jsPDF, x: number, y: number, complete: boolean): void {
  const s = 3.6;
  pdf.setLineWidth(0.4);
  if (complete) {
    setFill(pdf, COLORS.accent);
    pdf.setDrawColor(COLORS.accent.r, COLORS.accent.g, COLORS.accent.b);
    pdf.roundedRect(x, y, s, s, 0.6, 0.6, 'FD');
    // check mark
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    pdf.line(x + 0.8, y + 1.9, x + 1.5, y + 2.7);
    pdf.line(x + 1.5, y + 2.7, x + 2.9, y + 0.9);
  } else {
    pdf.setDrawColor(COLORS.muted.r, COLORS.muted.g, COLORS.muted.b);
    pdf.roundedRect(x, y, s, s, 0.6, 0.6, 'S');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setFont(
  pdf: jsPDF,
  family: 'helvetica' | 'courier',
  style: 'normal' | 'bold' | 'italic',
  size: number,
  color: RGB,
): void {
  pdf.setFont(family, style);
  pdf.setFontSize(size);
  pdf.setTextColor(color.r, color.g, color.b);
}

function setFill(pdf: jsPDF, c: RGB): void {
  pdf.setFillColor(c.r, c.g, c.b);
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Human label for the document type, derived from the title or type slug. */
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
      setFill(pdf, hexToRgb('EAF7EE')); // matches DOCX header fill
      pdf.rect(x, y, width, rowHeight, 'F');
    }

    pdf.setDrawColor(COLORS.divider.r, COLORS.divider.g, COLORS.divider.b);
    pdf.setLineWidth(0.2);
    setFont(pdf, 'helvetica', isHeader ? 'bold' : 'normal', 9.5, COLORS.text);

    for (let c = 0; c < colCount; c++) {
      const cellX = x + c * colWidth;
      pdf.rect(cellX, y, colWidth, rowHeight); // border
      const lines = wrappedRows[r][c];
      pdf.text(lines, cellX + cellPad, y + cellPad + lineHeight - 1);
    }

    y += rowHeight;
  }

  // Reset font for whatever the caller draws next.
  setFont(pdf, 'helvetica', 'normal', 10.5, COLORS.text);

  return y;
}
