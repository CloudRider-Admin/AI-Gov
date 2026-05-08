import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { getArtifactById } from '@/lib/artifacts';
import { DOCUMENT_TYPE_VALUES } from '@/lib/ai/schemas';
import type { GovernanceDocumentOutput } from '@/lib/ai/schemas';
import type { DocumentType } from '@/types/documents';
import { buildDocumentCode } from '@/lib/exporters/documentCode';

const DOCUMENT_TYPE_SET = new Set<string>(DOCUMENT_TYPE_VALUES);

function parseDocumentArtifact(
  artifact: { type: string; subType: string | null; content: string },
): { document: GovernanceDocumentOutput; documentType: DocumentType } | null {
  if (artifact.type !== 'document') return null;
  if (!artifact.subType || !DOCUMENT_TYPE_SET.has(artifact.subType)) return null;
  try {
    const document = JSON.parse(artifact.content) as GovernanceDocumentOutput;
    if (!document.sections || !Array.isArray(document.sections)) return null;
    return { document, documentType: artifact.subType as DocumentType };
  } catch {
    return null;
  }
}

/**
 * GET /api/artifacts/[id]/export?format=docx|pdf|md
 * Export a generated artifact as DOCX, PDF, or Markdown.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const format = request.nextUrl.searchParams.get('format') ?? 'md';

  if (!['md', 'docx', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use: md, docx, or pdf' }, { status: 400 });
  }

  const artifact = await getArtifactById(id, session.user.id);
  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  const markdown = artifact.markdownExport;
  if (!markdown) {
    return NextResponse.json({ error: 'Artifact has no exportable content' }, { status: 400 });
  }

  const safeTitle = artifact.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();

  // ── Markdown export ──
  if (format === 'md') {
    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeTitle}.md"`,
      },
    });
  }

  // Phase 2.6: documents that round-trip cleanly to GovernanceDocumentOutput
  // get the branded exporter (proper heading styles, footer with document
  // code, license block). Other artifacts fall back to the legacy
  // markdown-to-format path so playbooks / intakes still download.
  const branded = parseDocumentArtifact(artifact);
  const documentCode = branded
    ? buildDocumentCode({
        documentType: branded.documentType,
        userId: session.user.id,
        conversationId: artifact.conversationId ?? undefined,
        seed: artifact.title,
      })
    : null;

  // ── DOCX export ──
  if (format === 'docx') {
    try {
      let buffer: Buffer;
      if (branded && documentCode) {
        const { exportToWord } = await import('@/lib/exporters/govSecureWordExporter');
        buffer = await exportToWord(branded.document, {
          documentCode,
          version: `1.${artifact.version ?? 0}.0`,
          generatedAt: artifact.createdAt.toISOString(),
        });
      } else {
        const { markdownToDocx } = await import('@/lib/export/markdownToDocx');
        buffer = await markdownToDocx(markdown, artifact.title);
      }
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
          'Content-Length': String(buffer.length),
          ...(documentCode ? { 'X-Document-Code': documentCode } : {}),
        },
      });
    } catch (error) {
      console.error('[export/docx] Error:', error);
      return NextResponse.json(
        { error: 'Failed to generate DOCX', details: error instanceof Error ? error.message : 'Unknown' },
        { status: 500 },
      );
    }
  }

  // ── PDF export ──
  if (format === 'pdf') {
    try {
      let buffer: Buffer;
      if (branded && documentCode) {
        const { exportToPdf } = await import('@/lib/exporters/govSecurePdfExporter');
        buffer = await exportToPdf(branded.document, {
          documentCode,
          version: `1.${artifact.version ?? 0}.0`,
          generatedAt: artifact.createdAt.toISOString(),
        });
      } else {
        const { markdownToPdf } = await import('@/lib/export/markdownToPdf');
        buffer = await markdownToPdf(markdown, { title: artifact.title });
      }
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
          'Content-Length': String(buffer.length),
          ...(documentCode ? { 'X-Document-Code': documentCode } : {}),
        },
      });
    } catch (error) {
      console.error('[export/pdf] Error:', error);
      return NextResponse.json(
        { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
}