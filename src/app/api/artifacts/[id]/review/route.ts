import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { setArtifactReviewStatus, REVIEW_STATUSES } from '@/lib/artifacts';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !REVIEW_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid review status' }, { status: 400 });
  }

  const artifact = await setArtifactReviewStatus(id, session.user.id, body.status);
  if (!artifact) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ artifact });
}
