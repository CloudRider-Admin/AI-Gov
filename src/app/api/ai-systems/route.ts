import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { listAiSystems, createAiSystem, RISK_CATEGORIES, LIFECYCLE_STAGES } from '@/lib/aiSystems';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const systems = await listAiSystems(session.user.id);
  return NextResponse.json({ systems });
}

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (body.riskCategory && !RISK_CATEGORIES.includes(body.riskCategory)) {
    return NextResponse.json({ error: 'Invalid risk category' }, { status: 400 });
  }
  if (body.lifecycleStage && !LIFECYCLE_STAGES.includes(body.lifecycleStage)) {
    return NextResponse.json({ error: 'Invalid lifecycle stage' }, { status: 400 });
  }

  const system = await createAiSystem(session.user.id, body);
  return NextResponse.json({ system }, { status: 201 });
}
