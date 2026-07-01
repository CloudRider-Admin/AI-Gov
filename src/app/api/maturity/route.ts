import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { computeMaturity, recordMaturitySnapshot, getMaturityTrend } from '@/lib/maturity';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [current, trend] = await Promise.all([
    computeMaturity(session.user.id),
    getMaturityTrend(session.user.id),
  ]);
  return NextResponse.json({ current, trend });
}

/** Snapshot the current score (e.g. after finishing the onboarding assessment). */
export async function POST() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const current = await computeMaturity(session.user.id);
  await recordMaturitySnapshot(session.user.id, current);
  return NextResponse.json({ current }, { status: 201 });
}
