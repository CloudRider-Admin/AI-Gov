import { NextRequest, NextResponse } from 'next/server';
import { playbookRequestSchema } from '@/lib/ai/schemas';
import { playbookOrchestrator } from '@/lib/ai/multiAgent';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitHeaders } from '@/lib/rateLimitHeaders';
import { auditLog } from '@/lib/utils/logger';
import { saveArtifact } from '@/lib/artifacts';

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  const isGuest = !session;
  const role = isGuest ? 'GUEST' : (session!.user.role ?? 'FREE');

  // Playbook generation is Pro/Team only
  if (role === 'GUEST' || role === 'FREE') {
    return NextResponse.json(
      { error: 'Playbook generation requires a Pro or Team subscription.' },
      { status: 403 },
    );
  }

  const userId = session!.user.id;
  const rateCheck = await checkRateLimit(userId, '/api/playbooks', role);
  const rateLimitHeaders = buildRateLimitHeaders(rateCheck);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  try {
    const body = await request.json();
    const parseResult = playbookRequestSchema.safeParse(body);
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

    auditLog({
      event: 'request.received',
      data: { route: '/api/playbooks', framework: parseResult.data.framework, userId },
    });

    const playbook = await playbookOrchestrator.run(parseResult.data, process.env.OPENAI_API_KEY);

    const artifactId = await saveArtifact({
      userId,
      conversationId: parseResult.data.conversationId,
      type: 'playbook',
      subType: playbook.framework,
      title: playbook.title,
      riskTier: playbook.riskTier,
      useCaseName: playbook.useCaseName,
      content: playbook,
      markdownExport: playbook.markdownExport,
    });

    auditLog({ event: 'request.received', data: { route: '/api/playbooks', framework: playbook.framework } });
    return NextResponse.json({ ...playbook, artifactId }, { headers: rateLimitHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/playbooks]', message);
    return NextResponse.json({ error: 'Playbook generation failed. Please try again.' }, { status: 500 });
  }
}
