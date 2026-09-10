import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';

const onboardingSchema = z.object({
  aiTools: z.array(z.string()).max(50).optional(),
  primaryConcern: z.string().max(120).optional(),
  /** Stored value, e.g. "security" | "privacy-legal" | "engineering" | … */
  occupationalRole: z.string().max(60).optional(),
  // ── Organizational profile (onboarding step 1) ──
  orgName: z.string().max(200).optional(),
  orgIndustry: z.string().max(80).optional(),
  orgSize: z.string().max(40).optional(),
  orgJurisdiction: z.string().max(80).optional(),
});

/**
 * Persist onboarding answers (AI tools, primary concern, occupational role) and
 * mark onboarding complete. Previously the OnboardingWizard POSTed here but no
 * handler existed, so the answers were silently dropped.
 */
export async function POST(request: NextRequest) {
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

  const parsed = onboardingSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    aiTools,
    primaryConcern,
    occupationalRole,
    orgName,
    orgIndustry,
    orgSize,
    orgJurisdiction,
  } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      onboardingCompleted: true,
      ...(aiTools !== undefined ? { aiTools } : {}),
      ...(primaryConcern !== undefined ? { primaryConcern } : {}),
      ...(occupationalRole !== undefined ? { occupationalRole } : {}),
      ...(orgName !== undefined ? { orgName } : {}),
      ...(orgIndustry !== undefined ? { orgIndustry } : {}),
      ...(orgSize !== undefined ? { orgSize } : {}),
      ...(orgJurisdiction !== undefined ? { orgJurisdiction } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
