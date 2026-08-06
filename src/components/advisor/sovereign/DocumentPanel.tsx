'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  ClipboardCheck,
  BookOpen,
  FileDown,
  ChevronDown,
  Download,
  X,
  Loader2,
  Library,
} from 'lucide-react';
import type { AdvisorResponse } from '@/types/advisor';
import { getDocumentTypeMeta } from '../documentTypeMeta';
import { AuditIntelligencePanel } from './AuditIntelligencePanel';

/** Same shape as `AdvisorResponse['generatedArtifact']`. */
export interface ActiveArtifact {
  type: string;
  id: string;
  data?: unknown;
}

export type PanelTab = 'document' | 'analysis';

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  intake: { label: 'Intake Assessment', icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  document: { label: 'Governance Document', icon: <FileText className="h-3.5 w-3.5" /> },
  playbook: { label: 'Implementation Playbook', icon: <BookOpen className="h-3.5 w-3.5" /> },
};

export function artifactTitle(artifact: ActiveArtifact): string {
  const data = (artifact.data ?? {}) as Record<string, unknown>;
  return (
    (data.title as string) ??
    (data.useCaseName as string) ??
    TYPE_META[artifact.type]?.label ??
    'Generated document'
  );
}

function downloadMarkdown(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportMenu({ artifactId, title, markdown }: { artifactId: string; title: string; markdown: string }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'md' | 'docx' | 'pdf') => {
    if (format === 'md') {
      downloadMarkdown(markdown, `${title.replace(/\s+/g, '-').toLowerCase()}.md`);
      setOpen(false);
      return;
    }
    setExporting(format);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Export ${format} failed:`, err);
    } finally {
      setExporting(null);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 font-mono text-xs text-terminal-muted transition-colors duration-300 hover:text-terminal-green"
      >
        <FileDown className="h-3.5 w-3.5" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-terminal-border bg-terminal-dark shadow-lg">
            <button
              onClick={() => handleExport('md')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs text-terminal-muted transition-colors hover:bg-terminal-gray/40 hover:text-terminal-green"
            >
              <Download className="h-3 w-3" />
              Markdown (.md)
            </button>
            <button
              onClick={() => handleExport('docx')}
              disabled={!!exporting}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs text-terminal-muted transition-colors hover:bg-terminal-gray/40 hover:text-terminal-green disabled:opacity-50"
            >
              <FileText className="h-3 w-3" />
              {exporting === 'docx' ? 'Generating…' : 'Word (.docx)'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs text-terminal-muted transition-colors hover:bg-terminal-gray/40 hover:text-terminal-green disabled:opacity-50"
            >
              <FileDown className="h-3 w-3" />
              {exporting === 'pdf' ? 'Generating…' : 'PDF (.pdf)'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-terminal-border bg-terminal-gray/30 px-2.5 py-0.5 font-mono text-xs text-terminal-muted">
      {children}
    </span>
  );
}

/** The formatted, paginated "paper" view of a generated artifact. */
function DocumentView({ artifact }: { artifact: ActiveArtifact }) {
  const data = (artifact.data ?? {}) as Record<string, unknown>;
  const meta = TYPE_META[artifact.type] ?? TYPE_META.document;
  const title = artifactTitle(artifact);
  const riskTier = data.riskTier as string | undefined;
  const documentType = data.documentType as string | undefined;
  const framework = data.framework as string | undefined;
  const sections = (data.sections as Array<{ heading: string; content: string }>) ?? [];
  const markdown = (data.markdownExport as string) ?? '';
  const docTypeLabel = documentType ? getDocumentTypeMeta(documentType).label : meta.label;

  return (
    <div className="p-5">
      {/* Document header */}
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-terminal-green/10 px-2.5 py-1 font-mono text-xs font-semibold text-terminal-green">
          {meta.icon}
          {docTypeLabel}
        </span>
        <h3 className="mt-3 font-mono text-lg font-bold leading-snug tracking-tight text-terminal-text">
          {title}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {riskTier && <MetaChip>{riskTier}</MetaChip>}
          {framework && <MetaChip>{framework}</MetaChip>}
          {sections.length > 0 && <MetaChip>{sections.length} sections</MetaChip>}
          {artifact.type === 'intake' && data.totalScore != null && (
            <MetaChip>Score {String(data.totalScore)}/30</MetaChip>
          )}
          {artifact.type === 'intake' && typeof data.launchDecision === 'string' && (
            <MetaChip>{data.launchDecision}</MetaChip>
          )}
        </div>
      </div>

      {/* Document body — the "paper" */}
      <div className="rounded-xl border border-terminal-border bg-terminal-gray/20 px-5 py-6">
        {sections.length > 0 ? (
          <div className="space-y-6">
            {sections.map((section, i) => (
              <section key={`${section.heading}-${i}`}>
                <h4 className="mb-2 flex items-baseline gap-2 border-b border-terminal-border pb-1.5 font-mono text-sm font-bold text-terminal-text">
                  <span className="font-mono text-xs text-terminal-green">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {section.heading}
                </h4>
                <div className="sovereign-prose text-sm leading-relaxed text-terminal-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                </div>
              </section>
            ))}
          </div>
        ) : markdown ? (
          <div className="sovereign-prose text-sm leading-relaxed text-terminal-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-terminal-muted">This document has no preview content.</p>
        )}
      </div>
    </div>
  );
}

interface DocumentPanelProps {
  artifact: ActiveArtifact | null;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
  response: AdvisorResponse | null;
  isPaidUser: boolean;
  analyzing: boolean;
  /** True while an action-card / workflow generation is running. */
  generating: boolean;
}

/**
 * The console's right-hand pane. Behaves like Claude's artifacts panel: when
 * Govi generates a document it opens here as a formatted visual document
 * (with export actions), and the live governance analysis stays one tab away.
 */
export function DocumentPanel({
  artifact,
  tab,
  onTabChange,
  onClose,
  response,
  isPaidUser,
  analyzing,
  generating,
}: DocumentPanelProps) {
  const hasDoc = artifact != null;
  const activeTab: PanelTab = hasDoc || generating ? tab : 'analysis';
  const data = (artifact?.data ?? {}) as Record<string, unknown>;
  const markdown = (data.markdownExport as string) ?? '';

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-terminal-border bg-terminal-dark/40 lg:h-full lg:w-[420px] lg:border-l lg:border-t-0 xl:w-[460px]">
      {/* Panel header: tabs + document actions */}
      <div className="flex items-center justify-between gap-2 border-b border-terminal-border px-4 py-2.5">
        <div className="flex gap-1.5" role="tablist" aria-label="Console panel">
          <button
            role="tab"
            aria-selected={activeTab === 'analysis'}
            onClick={() => onTabChange('analysis')}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-300 ${
              activeTab === 'analysis'
                ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
                : 'border-transparent text-terminal-muted hover:text-terminal-text'
            }`}
          >
            Analysis
          </button>
          {(hasDoc || generating) && (
            <button
              role="tab"
              aria-selected={activeTab === 'document'}
              onClick={() => onTabChange('document')}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-300 ${
                activeTab === 'document'
                  ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
                  : 'border-transparent text-terminal-muted hover:text-terminal-text'
              }`}
            >
              Document
            </button>
          )}
        </div>

        {activeTab === 'document' && hasDoc && (
          <div className="flex items-center gap-3">
            {markdown && (
              <ExportMenu artifactId={artifact.id} title={artifactTitle(artifact)} markdown={markdown} />
            )}
            <Link
              href="/library"
              title="Open the Document Library"
              className="text-terminal-muted transition-colors duration-300 hover:text-terminal-green"
            >
              <Library className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document"
              className="text-terminal-muted transition-colors duration-300 hover:text-terminal-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Panel body */}
      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        {activeTab === 'document' ? (
          hasDoc ? (
            <DocumentView artifact={artifact} />
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-terminal-green" />
              <p className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
                Drafting document…
              </p>
            </div>
          )
        ) : (
          <AuditIntelligencePanel response={response} isPaidUser={isPaidUser} analyzing={analyzing} />
        )}
      </div>
    </aside>
  );
}
