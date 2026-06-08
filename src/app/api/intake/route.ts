import { NextRequest, NextResponse } from 'next/server';
import { intakeRequestSchema } from '@/lib/ai/schemas';
import { intakeOrchestrator } from '@/lib/ai/multiAgent';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitHeaders } from '@/lib/rateLimitHeaders';
import { auditLog } from '@/lib/utils/logger';
import { saveArtifact } from '@/lib/artifacts';
import { prisma } from '@/lib/prisma';
import { roleLabel } from '@/lib/occupationalRoles';

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  const isGuest = !session;
  const role = isGuest ? 'GUEST' : (session!.user.role ?? 'FREE');

  // Intake assessments are Pro/Team only
  if (role === 'GUEST' || role === 'FREE') {
    return NextResponse.json(
      { error: 'Intake risk assessments require a Pro or Team subscription.' },
      { status: 403 },
    );
  }

  // At this point session is guaranteed non-null (role check above eliminates GUEST)
  const userId = session!.user.id;
  const rateCheck = await checkRateLimit(userId, '/api/intake', role);
  const rateLimitHeaders = buildRateLimitHeaders(rateCheck);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  try {
    const body = await request.json();
    const parseResult = intakeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured.' },
        { status: 503 },
      );
    }

    auditLog({ event: 'request.received', data: { route: '/api/intake', userId } });

    // Surface the requesting user's occupational role on the assessment header.
    const dbUser = await prisma.user
      .findUnique({ where: { id: userId }, select: { occupationalRole: true } })
      .catch(() => null);
    const intakeRequest = {
      ...parseResult.data,
      occupationalRole: roleLabel(dbUser?.occupationalRole) ?? parseResult.data.occupationalRole,
    };

    const assessment = await intakeOrchestrator.run(intakeRequest, process.env.OPENAI_API_KEY);

    const artifactId = await saveArtifact({
      userId,
      conversationId: parseResult.data.conversationId,
      type: 'intake',
      title: assessment.useCaseName,
      riskTier: assessment.riskTier,
      useCaseName: assessment.useCaseName,
      content: assessment,
      markdownExport: assessment.markdownExport,
    });

    auditLog({ event: 'request.received', data: { route: '/api/intake', riskTier: assessment.riskTier } });
    return NextResponse.json({ ...assessment, artifactId }, { headers: rateLimitHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/intake]', message);
    return NextResponse.json({ error: 'Assessment failed. Please try again.' }, { status: 500 });
  }
}