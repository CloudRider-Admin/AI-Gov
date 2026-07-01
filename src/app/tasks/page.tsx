import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { listTasks } from '@/lib/remediation';
import { TasksClient } from './TasksClient';

export const metadata: Metadata = {
  title: 'Remediation Tasks',
  description: 'Track and close the action items that keep your AI governance on track.',
};

export default async function TasksPage() {
  const session = await requireSession();
  const tasks = await listTasks(session.user.id);
  const initialTasks = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
  return <TasksClient initialTasks={initialTasks} />;
}
