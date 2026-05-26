import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION = {
  rateLimit: 7,       // 7 days
  tokenUsage: 90,     // 90 days
  analyticsEvent: 180, // 180 days
  intentFeedback: 365, // 1 year
} as const;

function authorize(request: NextRequest): boolean {
  // Vercel Cron sets this header. Belt-and-braces: also accept a shared secret.
  const cronHeader = request.headers.get('x-vercel-cron');
  if (cronHeader === '1') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

function cutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const results: Record<string, number> = {};

  try {
    const [rateLimit, tokenUsage, analyticsEvent, intentFeedback] = await Promise.all([
      prisma.rateLimit.deleteMany({ where: { createdAt: { lt: cutoff(RETENTION.rateLimit) } } }),
      prisma.tokenUsage.deleteMany({ where: { createdAt: { lt: cutoff(RETENTION.tokenUsage) } } }),
      prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff(RETENTION.analyticsEvent) } } }),
      prisma.intentFeedback.deleteMany({ where: { createdAt: { lt: cutoff(RETENTION.intentFeedback) } } }),
    ]);

    results.rateLimit = rateLimit.count;
    results.tokenUsage = tokenUsage.count;
    results.analyticsEvent = analyticsEvent.count;
    results.intentFeedback = intentFeedback.count;

    auditLog({ event: 'cron.cleanup.ok', data: { ...results, durationMs: Date.now() - started } });

    return NextResponse.json({ ok: true, deleted: results, durationMs: Date.now() - started });
  } catch (err) {
    auditLog({ event: 'cron.cleanup.error', data: { error: err instanceof Error ? err.message : String(err) } });
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
