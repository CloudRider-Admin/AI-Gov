import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';

const VALID_EVENTS = ['artifact.created', 'artifact.versioned', 'query.completed'] as const;

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().startsWith('https'),
  events: z.array(z.enum(VALID_EVENTS)).min(1),
});

/**
 * GET /api/webhooks — list user's webhook endpoints
 */
export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ endpoints });
}

/**
 * POST /api/webhooks — create a new webhook endpoint
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Pro+ users can create webhooks
  const role = session.user.role ?? 'FREE';
  if (role === 'FREE' || role === 'GUEST') {
    return NextResponse.json({ error: 'Upgrade to Pro to use webhooks' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    // Max 5 webhooks per user
    const count = await prisma.webhookEndpoint.count({ where: { userId: session.user.id } });
    if (count >= 5) {
      return NextResponse.json({ error: 'Maximum 5 webhook endpoints per account' }, { status: 400 });
    }

    // Generate signing secret
    const secret = crypto.randomBytes(32).toString('hex');

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        url: parsed.data.url,
        events: parsed.data.events,
        secret,
      },
    });

    return NextResponse.json({
      id: endpoint.id,
      name: endpoint.name,
      secret, // Only returned once at creation
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks?id=xxx — delete a webhook endpoint
 */
export async function DELETE(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await prisma.webhookEndpoint.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
