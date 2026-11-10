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
  Maximize2,
  Minimize2,
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
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text"
      >
        <FileDown className="h-3.5 w-3.5" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="shadow-app absolute right-0 top-full z-20 mt-1 min-w-[170px] overflow-hidden rounded-xl border border-terminal-border bg-terminal-dark p-1">
            <button
              onClick={() => handleExport('md')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left rounded-md text-sm text-terminal-text transition-colors hover:bg-terminal-gray"
            >
              <Download className="h-3 w-3" />
              Markdown (.md)
            </button>
            <button
              onClick={() => handleExport('docx')}
              disabled={!!exporting}
              className="flex w-full items-center gap-2 px-3 py-2 text-left rounded-md text-sm text-terminal-text transition-colors hover:bg-terminal-gray disabled:opacity-50"
            >
              <FileText className="h-3 w-3" />
              {exporting === 'docx' ? 'Generating…' : 'Word (.docx)'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
              className="flex w-full items-center gap-2 px-3 py-2 text-left rounded-md text-sm text-terminal-text transition-colors hover:bg-terminal-gray disabled:opacity-50"
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
    <span className="inline-flex items-center rounded-full bg-terminal-gray px-2.5 py-0.5 text-xs text-terminal-muted">
      {children}
    </span>
  );
}

/** A generated artifact laid out as a readable document (centered reading width). */
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
    <article className="mx-auto w-full max-w-[760px] px-6 py-10 md:px-10">
      <p className="flex items-center gap-1.5 text-sm text-terminal-muted">
        {meta.icon}
        {docTypeLabel}
      </p>
      <h1 className="mt-2 font-serif text-[32px] font-medium leading-tight tracking-tight text-terminal-text">
        {title}
      </h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {riskTier && <MetaChip>{riskTier} risk</MetaChip>}
        {framework && <MetaChip>{framework}</MetaChip>}
        {sections.length > 0 && <MetaChip>{sections.length} sections</MetaChip>}
        {artifact.type === 'intake' && data.totalScore != null && (
          <MetaChip>Score {String(data.totalScore)}/30</MetaChip>
        )}
        {artifact.type === 'intake' && typeof data.launchDecision === 'string' && (
          <MetaChip>{data.launchDecision}</MetaChip>
        )}
      </div>

      <div className="mt-8 border-t border-terminal-border pt-8">
        {sections.length > 0 ? (
          <div className="space-y-9">
            {sections.map((section, i) => (
              <section key={`${section.heading}-${i}`}>
                <h2 className="mb-3 text-lg font-semibold tracking-tight text-terminal-text">
                  <span className="mr-2 tabular-nums text-terminal-muted">{i + 1}.</span>
                  {section.heading}
                </h2>
                <div className="doc-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                </div>
              </section>
            ))}
          </div>
        ) : markdown ? (
          <div className="doc-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-terminal-muted">This document has no preview content.</p>
        )}
      </div>
    </article>
  );
}

interface DocumentPaneProps {
  /** The open artifact, or null while a new one is still being drafted. */
  artifact: ActiveArtifact | null;
  generating: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

/**
 * The document side pane (Claude artifacts / Muse documents): when Govi
 * generates or the user opens a document, the chat narrows and the document
 * takes the rest of the screen, with export and expand/close controls.
 */
export function DocumentPane({ artifact, generating, expanded, onToggleExpand, onClose }: DocumentPaneProps) {
  const data = (artifact?.data ?? {}) as Record<string, unknown>;
  const markdown = (data.markdownExport as string) ?? '';
  const title = artifact ? artifactTitle(artifact) : 'Drafting document…';
  const iconBtn =
    'grid h-8 w-8 place-items-center rounded-lg text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text';

  return (
    <section
      aria-label="Document"
      className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-terminal-border bg-terminal-dark"
    >
      <header className="flex h-12 flex-none items-center gap-2 border-b border-terminal-border pl-4 pr-2">
        <FileText className="h-4 w-4 flex-none text-terminal-muted" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-terminal-text">{title}</h2>
        {artifact && markdown && (
          <ExportMenu artifactId={artifact.id} title={artifactTitle(artifact)} markdown={markdown} />
        )}
        <Link
          href="/library"
          title="Open the Document Library"
          aria-label="Open the Document Library"
          className={iconBtn}
        >
          <Library className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Show chat' : 'Expand document'}
          title={expanded ? 'Show chat' : 'Expand document'}
          className={`hidden lg:grid ${iconBtn}`}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onClose} aria-label="Close document" className={iconBtn}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {artifact ? (
          <DocumentView artifact={artifact} />
        ) : (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-terminal-green" />
            <p className="text-sm text-terminal-muted">
              {generating ? 'Govi is drafting your document…' : 'Preparing document…'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

interface InsightsPanelProps {
  response: AdvisorResponse | null;
  isPaidUser: boolean;
  analyzing: boolean;
  onClose: () => void;
}

/** Optional right-hand panel with the live governance analysis for the latest answer. */
export function InsightsPanel({ response, isPaidUser, analyzing, onClose }: InsightsPanelProps) {
  return (
    <aside
      aria-label="Governance insights"
      className="hidden w-[340px] flex-none flex-col border-l border-terminal-border bg-terminal-black xl:flex"
    >
      <header className="flex h-12 flex-none items-center justify-between border-b border-terminal-border pl-4 pr-2">
        <h2 className="text-sm font-medium text-terminal-text">Insights</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide insights"
          className="grid h-8 w-8 place-items-center rounded-lg text-terminal-muted transition-colors hover:bg-terminal-gray hover:text-terminal-text"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AuditIntelligencePanel response={response} isPaidUser={isPaidUser} analyzing={analyzing} />
      </div>
    </aside>
  );
}
