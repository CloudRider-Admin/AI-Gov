import { NextRequest, NextResponse } from 'next/server';
import { documentRequestSchema } from '@/lib/ai/schemas';
import { documentOrchestrator } from '@/lib/ai/multiAgent';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitHeaders } from '@/lib/rateLimitHeaders';
import { auditLog } from '@/lib/utils/logger';
import { saveArtifact } from '@/lib/artifacts';

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  const isGuest = !session;
  const role = isGuest ? 'GUEST' : (session!.user.role ?? 'FREE');

  // Document generation is Pro/Team only
  if (role === 'GUEST' || role === 'FREE') {
    return NextResponse.json(
      { error: 'Document generation requires a Pro or Team subscription.' },
      { status: 403 },
    );
  }

  const userId = session!.user.id;
  const rateCheck = await checkRateLimit(userId, '/api/documents', role);
  const rateLimitHeaders = buildRateLimitHeaders(rateCheck);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  try {
    const body = await request.json();
    const parseResult = documentRequestSchema.safeParse(body);
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
      data: { route: '/api/documents', documentType: parseResult.data.documentType, userId },
    });

    const document = await documentOrchestrator.run(parseResult.data, process.env.OPENAI_API_KEY);

    const artifactId = await saveArtifact({
      userId,
      conversationId: parseResult.data.conversationId,
      type: 'document',
      subType: document.documentType,
      title: document.title,
      riskTier: document.riskTier,
      useCaseName: document.useCaseName,
      content: document,
      markdownExport: document.markdownExport,
    });

    auditLog({ event: 'request.received', data: { route: '/api/documents', documentType: document.documentType } });
    return NextResponse.json({ ...document, artifactId }, { headers: rateLimitHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/documents]', message);
    return NextResponse.json({ error: 'Document generation failed. Please try again.' }, { status: 500 });
  }
}
