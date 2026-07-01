import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import {
  getAiSystem,
  updateAiSystem,
  archiveAiSystem,
  RISK_CATEGORIES,
  LIFECYCLE_STAGES,
} from '@/lib/aiSystems';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const system = await getAiSystem(session.user.id, id);
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ system });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  if (body.riskCategory && !RISK_CATEGORIES.includes(body.riskCategory)) {
    return NextResponse.json({ error: 'Invalid risk category' }, { status: 400 });
  }
  if (body.lifecycleStage && !LIFECYCLE_STAGES.includes(body.lifecycleStage)) {
    return NextResponse.json({ error: 'Invalid lifecycle stage' }, { status: 400 });
  }

  const system = await updateAiSystem(session.user.id, id, body);
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ system });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const system = await archiveAiSystem(session.user.id, id);
  if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
