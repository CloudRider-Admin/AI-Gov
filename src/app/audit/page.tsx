import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { getAuditLog } from '@/lib/audit';
import { FileClock } from 'lucide-react';
import { AppPage, PageHeader, Panel } from '@/components/app';

export const metadata: Metadata = {
  title: 'Audit Trail',
  description: 'Immutable record of governance actions across your workspace.',
};

const ACTION_LABELS: Record<string, string> = {
  'ai_system.created': 'System registered',
  'ai_system.updated': 'System updated',
  'ai_system.archived': 'System archived',
  'control.updated': 'Control updated',
  'task.created': 'Task created',
  'task.completed': 'Task completed',
  'artifact.approved': 'Artifact approved',
};

export default async function AuditPage() {
  const session = await requireSession();
  const entries = await getAuditLog({ actorId: session.user.id }, 200);

  return (
    <AppPage width="max-w-4xl">
      <PageHeader
        eyebrow="Governance / Audit"
        title="Audit Trail"
        description="An immutable, timestamped record of every governance action — the evidence auditors ask for, generated automatically."
      />

      {entries.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <FileClock className="w-10 h-10 text-terminal-muted mx-auto mb-4" />
          <p className="font-mono text-terminal-text mb-1">No activity yet</p>
          <p className="text-terminal-muted text-sm">
            Actions across the inventory, compliance, and tasks views will appear here.
          </p>
        </div>
      ) : (
        <Panel
          title="Activity log"
          action={
            <span className="font-normal text-terminal-muted">
              {entries.length} event{entries.length === 1 ? '' : 's'}
            </span>
          }
        >
          <div className="divide-y divide-terminal-border/50">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-terminal-green mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-terminal-green uppercase tracking-wider">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="rounded-md border border-terminal-border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                      {e.entityType}
                    </span>
                  </div>
                  <p className="text-sm text-terminal-text mt-0.5">{e.summary}</p>
                </div>
                <time className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-terminal-muted">
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </AppPage>
  );
}
