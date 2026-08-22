import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Never cache health results — probes must see live state.
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — liveness + readiness probe.
 *
 * Returns 200 when the database is reachable, 503 otherwise. The `services`
 * block reports which optional integrations are configured (not whether they
 * are healthy) so operators can spot missing configuration at a glance.
 * No secrets are returned — only booleans.
 */
export async function GET() {
  const startedAt = Date.now();

  let dbOk = false;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const body = {
    status: dbOk ? ('ok' as const) : ('degraded' as const),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database: dbOk ? ('up' as const) : ('down' as const),
    },
    services: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropicFallback: Boolean(process.env.ANTHROPIC_API_KEY),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      email: Boolean(process.env.RESEND_API_KEY),
    },
    responseTimeMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}
