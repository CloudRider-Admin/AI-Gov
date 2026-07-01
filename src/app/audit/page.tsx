import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { getAuditLog } from '@/lib/audit';
import { FileClock } from 'lucide-react';

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
    <div className="section min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-3 block">
            Governance / Audit
          </span>
          <h1 className="text-3xl md:text-4xl font-mono font-bold text-terminal-text mb-3">
            Audit Trail
          </h1>
          <p className="text-terminal-muted font-sans max-w-2xl">
            An immutable, timestamped record of every governance action — the evidence auditors ask
            for, generated automatically.
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <FileClock className="w-10 h-10 text-terminal-muted mx-auto mb-4" />
            <p className="font-mono text-terminal-text mb-1">No activity yet</p>
            <p className="text-terminal-muted text-sm">
              Actions across the inventory, compliance, and tasks views will appear here.
            </p>
          </div>
        ) : (
          <div className="glass-card rounded-xl divide-y divide-terminal-border/50">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-terminal-green mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-terminal-green uppercase tracking-wider">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-terminal-muted border border-terminal-border rounded px-1.5 py-0.5">
                      {e.entityType}
                    </span>
                  </div>
                  <p className="text-sm text-terminal-text mt-0.5">{e.summary}</p>
                </div>
                <time className="font-mono text-[11px] text-terminal-muted shrink-0 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
