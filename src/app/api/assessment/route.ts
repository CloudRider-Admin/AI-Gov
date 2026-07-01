import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { ASSESSMENT_QUESTIONS } from '@/lib/assessmentQuestions';
import { createTask } from '@/lib/remediation';
import { computeMaturity, recordMaturitySnapshot } from '@/lib/maturity';

/**
 * Process the onboarding maturity assessment (Tier 5): seed remediation tasks
 * for each gap, then snapshot the current maturity score.
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const answers = body?.answers;
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'answers object is required' }, { status: 400 });
  }

  // A "no" (false) answer seeds the recommended remediation task.
  const gaps = ASSESSMENT_QUESTIONS.filter((q) => answers[q.id] === false);
  let created = 0;
  for (const q of gaps) {
    await createTask(session.user.id, {
      title: q.remediation.title,
      description: q.remediation.description,
      priority: q.remediation.priority,
      framework: q.remediation.framework ?? null,
      controlId: q.remediation.controlId ?? null,
    });
    created += 1;
  }

  const maturity = await computeMaturity(session.user.id);
  await recordMaturitySnapshot(session.user.id, maturity, 'assessment');

  return NextResponse.json({ tasksCreated: created, score: maturity.score }, { status: 201 });
}
