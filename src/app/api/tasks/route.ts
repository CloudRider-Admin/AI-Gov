import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { listTasks, createTask, TASK_STATUSES, TASK_PRIORITIES } from '@/lib/remediation';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tasks = await listTasks(session.user.id);
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (body.status && !TASK_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (body.priority && !TASK_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  }

  const task = await createTask(session.user.id, body);
  return NextResponse.json({ task }, { status: 201 });
}
