/**
 * POST /api/workflows/[id]/finalize
 *
 * Build the final document from the completed workflow state and persist it
 * as a `GeneratedArtifact`. Returns the new artifactId + the structured
 * document.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOptionalSession } from '@/lib/auth-guard';
import { saveArtifact } from '@/lib/artifacts';
import { workflowOrchestrator } from '@/lib/ai/workflowOrchestrator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const conversationId = await workflowOrchestrator.getConversationId(id, session.user.id);
    const result = await workflowOrchestrator.finalize(id, session.user.id);
    const artifactId = await saveArtifact({
      userId: session.user.id,
      conversationId,
      type: 'document',
      subType: result.document.documentType,
      title: result.document.title,
      riskTier: result.document.riskTier,
      useCaseName: result.document.useCaseName,
      content: result.document,
      markdownExport: result.document.markdownExport,
    });
    await workflowOrchestrator.attachArtifact(id, session.user.id, artifactId);
    return NextResponse.json({
      artifactId,
      document: result.document,
      summary: result.summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to finalize', details: message }, { status: 400 });
  }
}
