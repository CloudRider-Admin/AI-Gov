import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import {
  getApprovalEligibility,
  recordApprovalDecision,
  withdrawApprovalDecision,
} from '@/lib/gates/approvals';
import { assertOwnedSystem } from '@/lib/gates/evaluations';
import { isApprovalDecision } from '@/lib/gates/gateEnums';

/** GET — can this entity be approved right now, and if not, what is blocking. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const system = await assertOwnedSystem(session.user.id, id);
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const eligibility = await getApprovalEligibility(id);
  return NextResponse.json({ eligibility });
}

/** POST — record an approval or rejection (Gate 3). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const system = await assertOwnedSystem(session.user.id, id);
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const decision = typeof body?.decision === 'string' ? body.decision : '';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';

  // "pending" is a withdrawal of a decision already on record, not a decision.
  // It runs through its own path so the reversal is audited as a reversal.
  if (decision === 'pending') {
    if (note.length < 10) {
      return NextResponse.json(
        {
          error:
            'Withdrawing a recorded decision requires a note of at least 10 characters explaining why.',
        },
        { status: 400 },
      );
    }

    const withdrawn = await withdrawApprovalDecision({
      aiSystemId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? null,
      reason: note,
    });

    if (!withdrawn.ok) {
      return NextResponse.json({ error: withdrawn.error, reasons: withdrawn.reasons }, { status: 409 });
    }
    return NextResponse.json({ system: withdrawn.system });
  }

  if (!isApprovalDecision(decision)) {
    return NextResponse.json(
      { error: 'decision must be one of: approved, rejected, pending' },
      { status: 400 },
    );
  }

  // A rejection without a reason gives the owner nothing to act on.
  if (decision === 'rejected' && note.length < 10) {
    return NextResponse.json(
      { error: 'A rejection must carry a note of at least 10 characters explaining the decision.' },
      { status: 400 },
    );
  }

  const result = await recordApprovalDecision({
    aiSystemId: id,
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? null,
    decision,
    note: note || null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, reasons: result.reasons }, { status: 409 });
  }

  return NextResponse.json({ system: result.system });
}
