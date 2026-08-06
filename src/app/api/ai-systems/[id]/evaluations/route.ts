import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import {
  listEvidence,
  addEvidence,
  EVALUATION_SOURCES,
  CORE_EVALUATION_PARAMETER_IDS,
} from '@/lib/evaluations';

/** Gate 2 — evaluation evidence collected for one registry entry. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const evidence = await listEvidence(session.user.id, id);
  if (evidence === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ evidence });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.result !== 'string' || !body.result.trim()) {
    return NextResponse.json({ error: 'result is required' }, { status: 400 });
  }
  if (!CORE_EVALUATION_PARAMETER_IDS.includes(body.reviewArea)) {
    return NextResponse.json({ error: 'Invalid review area' }, { status: 400 });
  }
  if (body.source && !EVALUATION_SOURCES.includes(body.source)) {
    return NextResponse.json({ error: 'Invalid evaluation source' }, { status: 400 });
  }
  if (body.meetsBaseline !== undefined && body.meetsBaseline !== null && typeof body.meetsBaseline !== 'boolean') {
    return NextResponse.json({ error: 'meetsBaseline must be a boolean' }, { status: 400 });
  }

  const evidence = await addEvidence(session.user.id, id, body);
  if (!evidence) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ evidence }, { status: 201 });
}
