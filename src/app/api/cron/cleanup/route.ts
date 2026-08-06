import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron/auth';
import { runCleanup } from '@/lib/cron/cleanup';
import { auditLog } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cleanup — scheduled maintenance.
 *
 * Registered in vercel.json under `crons`. Deletes expired auth tokens and
 * time-expired operational rows (rate-limit, token-usage, analytics). Protected
 * by the CRON_SECRET bearer token that Vercel Cron sends automatically.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deleted = await runCleanup();
    auditLog({ event: 'cron.cleanup', data: { ...deleted } });
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error('[cron/cleanup]', err);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
