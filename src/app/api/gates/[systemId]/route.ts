import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { getGateRecords, refreshGates, waiveGate } from '@/lib/gates/gates';
import { assertOwnedSystem } from '@/lib/gates/evaluations';
import { getApprovalEligibility, getApprovalAuthority } from '@/lib/gates/approvals';
import { GATES, type GateNumber } from '@/lib/gates/gateEnums';

/** Current gate posture for one registered entity. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { systemId } = await params;
  const system = await assertOwnedSystem(session.user.id, systemId);
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Recompute before reading so the caller never sees a stale board.
  await refreshGates(systemId, session.user.id);
  const [gates, approval] = await Promise.all([
    getGateRecords(systemId),
    getApprovalEligibility(systemId),
  ]);

  return NextResponse.json({ gates, approval });
}

/** Force a recomputation, or waive a gate. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { systemId } = await params;
  const system = await assertOwnedSystem(session.user.id, systemId);
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : 'refresh';

  if (action === 'waive') {
    const gate = Number(body.gate);
    if (!GATES.includes(gate as GateNumber)) {
      return NextResponse.json({ error: 'Invalid gate' }, { status: 400 });
    }
    const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
    // A waiver without a reason is worse than no waiver — it leaves an
    // unexplained override in the audit trail.
    if (justification.length < 10) {
      return NextResponse.json(
        { error: 'A written justification of at least 10 characters is required to waive a gate.' },
        { status: 400 },
      );
    }

    // Waiving a gate is materially the same act as approving without evidence,
    // so it answers to the same separation of duties.
    const authority = await getApprovalAuthority(system.userId, session.user.id);
    if (!authority.permitted) {
      return NextResponse.json(
        {
          error: 'Separation of duties: a different approver is required to waive a gate',
          reasons: [authority.reason],
        },
        { status: 403 },
      );
    }

    await waiveGate({
      aiSystemId: systemId,
      gate: gate as GateNumber,
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? null,
      organizationId: system.organizationId,
      justification,
      selfGranted: authority.selfRecorded,
    });

    return NextResponse.json({ gates: await getGateRecords(systemId) });
  }

  await refreshGates(systemId, session.user.id);
  return NextResponse.json({ gates: await getGateRecords(systemId) });
}
