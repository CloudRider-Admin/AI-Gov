import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { setApprovalStatus, APPROVAL_STATUSES } from '@/lib/aiSystems';

/**
 * Gate 3 — Approval & Registry. Records an Approved / Pending / Rejected
 * decision (with approver identity) for a medium/high risk entry.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !APPROVAL_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: 'status must be one of: approved, pending, rejected' },
      { status: 400 },
    );
  }

  const approverName = session.user.name ?? session.user.email ?? 'Unknown approver';
  const result = await setApprovalStatus(
    session.user.id,
    id,
    body.status,
    approverName,
    typeof body.note === 'string' ? body.note : null,
  );

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ system: result.system });
}
