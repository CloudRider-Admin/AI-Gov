import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { getDashboardStats } from '@/lib/analytics';

export async function GET() {
  const session = await getOptionalSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[admin/analytics] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
