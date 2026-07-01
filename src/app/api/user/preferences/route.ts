import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';

/** Valid Govi interface skins. Keep in sync with `goviInterface` on the User model. */
export const GOVI_INTERFACES = ['terminal', 'sovereign'] as const;
export type GoviInterface = (typeof GOVI_INTERFACES)[number];

const preferencesSchema = z.object({
  goviInterface: z.enum(GOVI_INTERFACES).optional(),
});

/** Return the signed-in user's UI preferences. */
export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { goviInterface: true },
    })
    .catch(() => null);

  return NextResponse.json({
    goviInterface: (user?.goviInterface as GoviInterface) ?? 'terminal',
  });
}

/** Persist UI preferences (currently just the Govi interface skin). */
export async function PATCH(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = preferencesSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { goviInterface } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(goviInterface !== undefined ? { goviInterface } : {}),
    },
    select: { goviInterface: true },
  });

  return NextResponse.json({ ok: true, goviInterface: updated.goviInterface });
}
