import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { deleteEvidence } from '@/lib/evaluations';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, evidenceId } = await params;
  const ok = await deleteEvidence(session.user.id, id, evidenceId);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
