import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { listReports, generateEvidenceReport } from '@/lib/evaluations';

/** Gate 2 — evidence reports for one registry entry (latest first). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const reports = await listReports(session.user.id, id);
  if (reports === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ reports });
}

/**
 * Reviews the collected evaluation evidence against the Core Evaluation
 * Parameters baselines and creates a new evidence report.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const generatedBy = session.user.name ?? session.user.email ?? 'Unknown reviewer';
  const report = await generateEvidenceReport(session.user.id, id, generatedBy);
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ report }, { status: 201 });
}
