import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { setAssessment, ASSESSMENT_STATUSES } from '@/lib/compliance';

export async function PATCH(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.framework || !body.controlId || !body.status) {
    return NextResponse.json({ error: 'framework, controlId and status are required' }, { status: 400 });
  }
  if (!ASSESSMENT_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const row = await setAssessment(session.user.id, body.framework, body.controlId, body.status, body.evidence);
  if (!row) return NextResponse.json({ error: 'Unknown framework or control' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
