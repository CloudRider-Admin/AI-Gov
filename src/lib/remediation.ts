import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { TASK_STATUSES, TASK_PRIORITIES, type TaskStatus, type TaskPriority } from './governanceEnums';

export { TASK_STATUSES, TASK_PRIORITIES };
export type { TaskStatus, TaskPriority };

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  aiSystemId?: string | null;
  framework?: string | null;
  controlId?: string | null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function listTasks(userId: string) {
  return prisma.remediationTask.findMany({
    where: { userId },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createTask(userId: string, input: TaskInput) {
  const task = await prisma.remediationTask.create({
    data: {
      userId,
      title: input.title.trim(),
      description: input.description ?? null,
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      dueDate: parseDate(input.dueDate),
      assigneeId: input.assigneeId ?? null,
      aiSystemId: input.aiSystemId ?? null,
      framework: input.framework ?? null,
      controlId: input.controlId ?? null,
    },
  });

  writeAuditLog({
    actorId: userId,
    action: 'task.created',
    entityType: 'task',
    entityId: task.id,
    summary: `Created remediation task "${task.title}"`,
  });

  return task;
}

export async function updateTask(userId: string, id: string, input: Partial<TaskInput>) {
  const existing = await prisma.remediationTask.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return null;

  const nowDone = input.status === 'done' && existing.status !== 'done';

  const task = await prisma.remediationTask.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined ? { dueDate: parseDate(input.dueDate) } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(nowDone ? { completedAt: new Date() } : {}),
      ...(input.status !== undefined && input.status !== 'done' ? { completedAt: null } : {}),
    },
  });

  if (nowDone) {
    writeAuditLog({
      actorId: userId,
      action: 'task.completed',
      entityType: 'task',
      entityId: task.id,
      summary: `Completed remediation task "${task.title}"`,
    });
  }

  return task;
}

export async function deleteTask(userId: string, id: string) {
  const existing = await prisma.remediationTask.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return null;
  await prisma.remediationTask.delete({ where: { id } });
  return existing;
}

/** Health metrics for the maturity score (Tier 3) and dashboard. */
export async function getRemediationSummary(userId: string) {
  const tasks = await prisma.remediationTask.findMany({
    where: { userId },
    select: { status: true, dueDate: true },
  });
  const now = Date.now();
  let open = 0;
  let overdue = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.status === 'done') done += 1;
    else {
      open += 1;
      if (t.dueDate && t.dueDate.getTime() < now) overdue += 1;
    }
  }
  return { total: tasks.length, open, overdue, done };
}
