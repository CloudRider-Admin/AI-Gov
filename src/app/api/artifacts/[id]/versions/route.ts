import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { getArtifactVersions, createArtifactVersion, rollbackArtifact } from '@/lib/artifacts';

/**
 * GET /api/artifacts/:id/versions
 * Returns the full version history for an artifact.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const versions = await getArtifactVersions(id, session.user.id);
  return NextResponse.json({ versions });
}

/**
 * POST /api/artifacts/:id/versions
 * Create a new version of an artifact, or rollback to an existing version.
 *
 * Body for new version:
 *   { action: "create", content: object, markdownExport: string, changeNote?: string }
 *
 * Body for rollback:
 *   { action: "rollback", targetVersionId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();

    if (body.action === 'rollback') {
      if (!body.targetVersionId) {
        return NextResponse.json({ error: 'targetVersionId required' }, { status: 400 });
      }
      const newId = await rollbackArtifact(body.targetVersionId, session.user.id);
      return NextResponse.json({ id: newId, action: 'rollback' });
    }

    // Default: create new version
    if (!body.content || !body.markdownExport) {
      return NextResponse.json({ error: 'content and markdownExport required' }, { status: 400 });
    }

    const newId = await createArtifactVersion(id, session.user.id, {
      content: body.content,
      markdownExport: body.markdownExport,
      changeNote: body.changeNote,
    });

    return NextResponse.json({ id: newId, action: 'create' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
