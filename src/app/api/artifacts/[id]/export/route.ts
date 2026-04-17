import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { getArtifactById } from '@/lib/artifacts';

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

  // ── DOCX export ──
  if (format === 'docx') {
    try {
      const { markdownToDocx } = await import('@/lib/export/markdownToDocx');
      const buffer = await markdownToDocx(markdown, artifact.title);

      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
          'Content-Length': String(buffer.length),
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
      const { markdownToPdf } = await import('@/lib/export/markdownToPdf');
      const buffer = await markdownToPdf(markdown, { title: artifact.title });

      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
          'Content-Length': String(buffer.length),
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
