'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Loader2, X, BookOpen, AlertCircle } from 'lucide-react';
import type { RegulationExplainerResponse } from '@/app/api/regulations/explain/route';
import { toSlugs } from '@/lib/regulations/lookup';

interface RegulationDetailPanelProps {
  regulation: string;
  article: string;
  /** Original advisor query — passed to the LLM fallback for tailoring. */
  query?: string;
  onClose: () => void;
}

/**
 * Render a markdown-ish body without pulling in a markdown lib.
 * Supports the three patterns the explainer bodies use:
 *   - **bold** inline
 *   - Bullet lines starting with `- `
 *   - Blank-line-separated paragraphs
 *
 * Curated bodies and LLM-generated bodies both follow the same shape
 * (enforced by the system prompt in `/api/regulations/explain`).
 */
function RenderBody({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n\s*\n/);

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-terminal-green font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-3 text-sm leading-relaxed font-sans text-terminal-text">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const isBullets = lines.every((l) => l.trim().startsWith('- '));
        if (isBullets) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^-\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(block)}</p>;
      })}
    </div>
  );
}

export function RegulationDetailPanel({
  regulation,
  article,
  query,
  onClose,
}: RegulationDetailPanelProps) {
  const [data, setData] = useState<RegulationExplainerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch('/api/regulations/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regulation, article, query }),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error ?? `Request failed (${res.status})`);
        }
        return payload as RegulationExplainerResponse;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [regulation, article, query]);

  const { fullSlug } = toSlugs(regulation, article);
  const readerHref = `/govi/regulations/${fullSlug}`;

  return (
    <div
      className="mt-3 border border-terminal-green/30 rounded-xl bg-terminal-bg/60 overflow-hidden"
      role="region"
      aria-label={`Expanded reader for ${regulation} ${article}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-terminal-border bg-terminal-gray/40">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-terminal-green shrink-0" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-wider text-terminal-green truncate">
            {regulation} · {article}
            {data?.title ? (
              <span className="text-terminal-muted normal-case font-sans tracking-normal">
                {' '}— {data.title}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={readerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono px-2 py-1 border border-terminal-green/40 text-terminal-green rounded hover:bg-terminal-green/10 transition-colors flex items-center gap-1"
            title="Open in a new page"
          >
            Open in page <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-terminal-muted hover:text-terminal-text transition-colors p-1 -mr-1"
            aria-label="Close expanded reader"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm font-mono text-terminal-muted py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading explainer…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-2 text-sm text-terminal-amber bg-terminal-amber/5 border border-terminal-amber/30 rounded p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-mono text-xs uppercase tracking-wider mb-1">Couldn&apos;t load explainer</p>
              <p className="font-sans">{error}</p>
            </div>
          </div>
        )}

        {data && !loading && (
          <>
            <RenderBody markdown={data.body} />

            {/* Sidebar info collapsed to inline rows */}
            {(data.relatedDocs.length > 0 || data.nistMappings.length > 0 || data.officialUrl) && (
              <div className="mt-5 pt-4 border-t border-terminal-border space-y-3">
                {data.relatedDocs.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-terminal-muted mb-1.5">
                      Related GovSecure templates
                    </p>
                    <ul className="space-y-1">
                      {data.relatedDocs.map((d) => (
                        <li
                          key={d.documentCode}
                          className="text-xs font-sans text-terminal-text flex items-center gap-2"
                        >
                          <FileText className="w-3 h-3 text-terminal-green/70 shrink-0" aria-hidden="true" />
                          <span>{d.title}</span>
                          <span className="font-mono text-[10px] text-terminal-muted">
                            ({d.documentCode})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.nistMappings.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-terminal-muted mb-1.5">
                      NIST AI RMF mapping
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.nistMappings.map((m) => (
                        <span
                          key={m}
                          className="font-mono text-[10px] px-2 py-0.5 rounded bg-terminal-green/10 text-terminal-green border border-terminal-green/30"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {data.officialUrl && (
                  <a
                    href={data.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-terminal-green hover:underline"
                  >
                    View official source <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {data.source === 'generated' && (
                  <p className="text-[10px] font-mono text-terminal-muted italic">
                    Generated explainer — verify against the official source before relying on it.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
