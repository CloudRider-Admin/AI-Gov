import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { attachEvidence, getEvaluationRun } from '@/lib/gates/evaluations';
import {
  parseEvidenceFile,
  normalizeRow,
  type NormalizedResult,
  type IngestionOutcome,
} from '@/lib/gates/evidenceIngestion';
import { isEvaluationArea } from '@/lib/gates/coreEvaluationParameters';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — eval exports are text, not media.
const MAX_RESULTS = 500;

/**
 * POST /api/evaluations/:id/evidence
 *
 * Two intake shapes on one route:
 *   • multipart/form-data with `file` — a JSON/CSV/Markdown export from the AI
 *     platform the evaluation was run on.
 *   • application/json with `results: [...]` — rows from the manual entry form.
 *
 * Both land in the same normalizer, so a manually-typed run and an uploaded one
 * are indistinguishable downstream.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role ?? 'FREE';
  const rateCheck = await checkRateLimit(session.user.id, '/api/evaluations/evidence', role);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  const { id } = await params;
  const run = await getEvaluationRun(session.user.id, id);
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const contentType = request.headers.get('content-type') ?? '';

  try {
    let outcome: IngestionOutcome;
    let rawPayload: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
      }

      const text = await file.text();
      if (!text.trim()) {
        return NextResponse.json({ error: 'The uploaded file is empty' }, { status: 400 });
      }

      outcome = parseEvidenceFile(file.name, file.type, text);
      // Keep the original for audit, but cap it so one enormous export cannot
      // bloat the row.
      rawPayload = text.slice(0, 100_000);
    } else {
      const body = await request.json().catch(() => null);
      if (!body || !Array.isArray(body.results)) {
        return NextResponse.json({ error: 'Expected a `results` array' }, { status: 400 });
      }

      const results: NormalizedResult[] = [];
      const unmapped: IngestionOutcome['unmapped'] = [];
      const warnings: string[] = [];

      for (const row of body.results) {
        if (!row || typeof row !== 'object') continue;

        // The manual form posts a known area; trust it when it is valid rather
        // than re-resolving from a label the user already chose.
        if (typeof row.area === 'string' && isEvaluationArea(row.area)) {
          const parameter = typeof row.parameter === 'string' ? row.parameter.trim() : '';
          const hasValue = row.metricValue !== undefined && row.metricValue !== null && row.metricValue !== '';
          const textValue = typeof row.textValue === 'string' ? row.textValue.trim() : '';
          if (!parameter || (!hasValue && !textValue)) continue;

          const metricValue = hasValue ? Number(row.metricValue) : null;
          results.push({
            area: row.area,
            parameter,
            metricValue: metricValue !== null && Number.isFinite(metricValue) ? metricValue : null,
            unit: typeof row.unit === 'string' && row.unit ? row.unit : null,
            textValue: textValue || null,
            method: typeof row.method === 'string' && row.method ? row.method.trim() : null,
            sampleSize:
              row.sampleSize !== undefined && row.sampleSize !== null && row.sampleSize !== ''
                ? Math.round(Number(row.sampleSize)) || null
                : null,
            evidenceUrl: typeof row.evidenceUrl === 'string' && row.evidenceUrl ? row.evidenceUrl.trim() : null,
          });
          continue;
        }

        const normalized = normalizeRow(row as Record<string, unknown>);
        if ('result' in normalized) results.push(normalized.result);
        else if ('unmapped' in normalized) unmapped.push(normalized.unmapped);
      }

      if (unmapped.length > 0) {
        warnings.push(
          `${unmapped.length} row(s) could not be mapped to a core review area and were not saved.`,
        );
      }
      outcome = { results, unmapped, warnings };
      rawPayload = JSON.stringify(body).slice(0, 100_000);
    }

    if (outcome.results.length === 0) {
      return NextResponse.json(
        {
          error: 'No usable evaluation results were found.',
          warnings: outcome.warnings,
          unmapped: outcome.unmapped.map((u) => u.label),
        },
        { status: 400 },
      );
    }

    if (outcome.results.length > MAX_RESULTS) {
      return NextResponse.json(
        { error: `Too many results (${outcome.results.length}). The limit per run is ${MAX_RESULTS}.` },
        { status: 400 },
      );
    }

    const updated = await attachEvidence({
      userId: session.user.id,
      runId: id,
      results: outcome.results,
      rawPayload,
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      run: updated,
      ingested: outcome.results.length,
      unmapped: outcome.unmapped.map((u) => u.label),
      warnings: outcome.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[evaluations/evidence] Error:', message);
    return NextResponse.json({ error: 'Failed to ingest evaluation evidence' }, { status: 500 });
  }
}
