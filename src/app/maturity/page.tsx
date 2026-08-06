import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth-guard';
import { computeMaturity, getMaturityTrend, type MaturityDimensions } from '@/lib/maturity';
import { getRegulatoryFeed } from '@/lib/regulatory';
import { Lightbulb, Radar, ArrowRight } from 'lucide-react';
import { AppPage, PageHeader } from '@/components/app';

export const metadata: Metadata = {
  title: 'Governance Maturity',
  description: 'Your AI governance maturity score, trend, and what to do next.',
};

const DIMENSION_LABELS: Record<keyof MaturityDimensions, string> = {
  inventory: 'Inventory',
  controls: 'Control coverage',
  reviewCadence: 'Review cadence',
  remediation: 'Remediation',
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'text-terminal-muted border-terminal-border',
  notable: 'text-terminal-amber border-terminal-amber/40',
  critical: 'text-terminal-red border-terminal-red/40',
};

function scoreColor(n: number) {
  if (n >= 75) return '#00ff88';
  if (n >= 40) return '#ffb800';
  return '#ff5555';
}

export default async function MaturityPage() {
  const session = await requireSession();
  const [maturity, trend, feed] = await Promise.all([
    computeMaturity(session.user.id),
    getMaturityTrend(session.user.id),
    getRegulatoryFeed(8),
  ]);

  const { score, dimensions, nudges } = maturity;
  const circumference = 2 * Math.PI * 52;
  const dash = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Governance / Maturity"
        title="AI Governance Maturity"
        description="A single, trending measure of how well-governed your AI footprint is — computed live from your inventory, controls, review cadence, and open work."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Score gauge */}
          <div className="glass rounded-xl p-6 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(var(--color-border-rgb))" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-4xl font-bold text-terminal-text">{score}</span>
                <span className="font-mono text-xs uppercase tracking-wider text-terminal-muted">/ 100</span>
              </div>
            </div>
            <p className="font-mono text-xs text-terminal-muted mt-3">
              {trend.length > 1
                ? `${trend.length} snapshots recorded`
                : 'Take the assessment to set your baseline'}
            </p>
            <Link href="/assessment" className="btn-secondary text-xs py-1.5 mt-3">
              {trend.length > 0 ? 'Retake assessment' : 'Start assessment'}
            </Link>
          </div>

          {/* Dimensions */}
          <div className="glass rounded-xl p-6 lg:col-span-2">
            <h2 className="font-mono text-sm text-terminal-text mb-4">Score breakdown</h2>
            <div className="space-y-4">
              {(Object.keys(dimensions) as (keyof MaturityDimensions)[]).map((key) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-terminal-muted">{DIMENSION_LABELS[key]}</span>
                    <span className="font-mono text-xs text-terminal-text">{dimensions[key]}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-terminal-gray overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${dimensions[key]}%`, backgroundColor: scoreColor(dimensions[key]) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Proactive nudges */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-terminal-green" />
              <h2 className="font-mono text-sm text-terminal-text">Recommended next steps</h2>
            </div>
            {nudges.length === 0 ? (
              <p className="text-sm text-terminal-muted">
                Nothing urgent — your governance posture is in good shape. 🎉
              </p>
            ) : (
              <ul className="space-y-2">
                {nudges.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-terminal-text">
                    <ArrowRight className="w-4 h-4 text-terminal-green mt-0.5 shrink-0" />
                    {n}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex gap-2">
              <Link href="/inventory" className="btn-secondary text-xs py-1.5">Inventory</Link>
              <Link href="/compliance" className="btn-secondary text-xs py-1.5">Compliance</Link>
              <Link href="/tasks" className="btn-secondary text-xs py-1.5">Tasks</Link>
            </div>
          </div>

          {/* Regulatory radar */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Radar className="w-4 h-4 text-terminal-green" />
              <h2 className="font-mono text-sm text-terminal-text">Regulatory radar</h2>
            </div>
            <ul className="space-y-3">
              {feed.map((item) => (
                <li key={item.id} className="border-b border-terminal-border/50 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-xs uppercase tracking-wider border rounded-md px-1.5 py-0.5 font-mono ${
                        SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.info
                      }`}
                    >
                      {item.jurisdiction}
                    </span>
                    <time className="font-mono text-xs text-terminal-muted">
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </time>
                  </div>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-terminal-text hover:text-terminal-green transition-colors"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="font-mono text-sm text-terminal-text">{item.title}</span>
                  )}
                  <p className="text-xs text-terminal-muted mt-0.5">{item.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
    </AppPage>
  );
}
