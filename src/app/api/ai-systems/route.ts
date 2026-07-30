import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import {
  listAiSystems,
  createAiSystem,
  RISK_CATEGORIES,
  LIFECYCLE_STAGES,
  ENTITY_KINDS,
  type EntityKind,
} from '@/lib/aiSystems';

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kindParam = request.nextUrl.searchParams.get('entityKind');
  const entityKind =
    kindParam && (ENTITY_KINDS as readonly string[]).includes(kindParam)
      ? (kindParam as EntityKind)
      : undefined;

  const systems = await listAiSystems(session.user.id, entityKind);
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
  if (body.entityKind && !ENTITY_KINDS.includes(body.entityKind)) {
    return NextResponse.json({ error: 'Invalid entity kind' }, { status: 400 });
  }

  const system = await createAiSystem(session.user.id, body);
  return NextResponse.json({ system }, { status: 201 });
}
