import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { extractDocumentText } from '@/lib/documentParser';
import { analyzeDocumentGaps } from '@/lib/documentAnalysis';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkTokenBudget } from '@/lib/tokenBudget';
import { ingestUserDocument } from '@/lib/userDocuments';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

/**
 * POST /api/documents/upload
 * Upload a policy/document for AI gap analysis against governance frameworks.
 *
 * Accepts: PDF, DOCX, TXT, MD (max 5MB)
 * Returns: Gap analysis with framework alignment, missing sections, recommendations.
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role ?? 'FREE';

  // Only Pro+ users can upload documents
  if (role === 'FREE' || role === 'GUEST') {
    return NextResponse.json({ error: 'Upgrade to Pro to upload documents for analysis' }, { status: 403 });
  }

  // Rate limit
  const rateCheck = await checkRateLimit(session.user.id, '/api/documents/upload', role);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Token budget
  const budget = await checkTokenBudget(session.user.id, role);
  if (!budget.allowed) {
    return NextResponse.json({ error: 'Monthly token budget exceeded' }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const framework = (formData.get('framework') as string) ?? 'Combined';
    // Documents are added to the user's RAG corpus by default; opt out with addToKnowledge=false.
    const addToKnowledge = (formData.get('addToKnowledge') as string) !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({
        error: `Unsupported file type: ${file.type}. Accepted: PDF, DOCX, TXT, MD`,
      }, { status: 400 });
    }

    // Extract text from uploaded file
    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractDocumentText(buffer, file.type, file.name);

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract meaningful text from the document' }, { status: 400 });
    }

    // Truncate to ~8000 tokens worth (~32000 chars) to fit in context window
    const truncatedText = extractedText.slice(0, 32000);

    // Run AI gap analysis
    const analysis = await analyzeDocumentGaps({
      userId: session.user.id,
      documentText: truncatedText,
      fileName: file.name,
      framework,
    });

    // Persist + embed so the advisor can retrieve this document later (RAG).
    let indexed: { documentId: string; chunkCount: number } | null = null;
    if (addToKnowledge) {
      try {
        indexed = await ingestUserDocument({
          userId: session.user.id,
          fileName: file.name,
          text: extractedText,
          framework,
        });
      } catch (err) {
        console.error('[documents/upload] Indexing failed (analysis still returned):', err);
      }
    }

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      extractedLength: extractedText.length,
      truncated: extractedText.length > 32000,
      framework,
      analysis,
      indexed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[documents/upload] Error:', message);
    return NextResponse.json({ error: 'Failed to analyze document' }, { status: 500 });
  }
}