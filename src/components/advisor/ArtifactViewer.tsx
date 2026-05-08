'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText, ClipboardCheck, BookOpen, FileDown } from 'lucide-react';
import {
  getDocumentTypeMeta,
  getCategoryBadgeClass,
  getCategoryLabel,
  isGovSecureType,
} from './documentTypeMeta';

interface ArtifactViewerProps {
  artifact: {
    type: string;
    id: string;
    data?: unknown;
  };
}

const TYPE_META: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  intake: {
    label: 'Intake Assessment',
    badge: 'bg-terminal-amber/10 text-terminal-amber',
    icon: <ClipboardCheck className="w-4 h-4" />,
  },
  document: {
    label: 'Governance Document',
    badge: 'bg-terminal-green/10 text-terminal-green',
    icon: <FileText className="w-4 h-4" />,
  },
  playbook: {
    label: 'Implementation Playbook',
    badge: 'bg-terminal-cyan/10 text-terminal-cyan',
    icon: <BookOpen className="w-4 h-4" />,
  },
};

function downloadMarkdown(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function IntakeSummary({ data }: { data: Record<string, unknown> }) {
  const riskTier = data.riskTier as string;
  const totalScore = data.totalScore as number;
  const launchDecision = data.launchDecision as string;
  const useCaseName = data.useCaseName as string;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="border border-terminal-border rounded px-3 py-2">
          <p className="text-xs font-mono text-terminal-muted">Risk Tier</p>
          <p className="text-sm font-mono text-terminal-text font-bold">{riskTier}</p>
        </div>
        <div className="border border-terminal-border rounded px-3 py-2">
          <p className="text-xs font-mono text-terminal-muted">Score</p>
          <p className="text-sm font-mono text-terminal-text font-bold">{totalScore}/30</p>
        </div>
        <div className="border border-terminal-border rounded px-3 py-2">
          <p className="text-xs font-mono text-terminal-muted">Launch</p>
          <p className="text-sm font-mono text-terminal-text font-bold">{launchDecision}</p>
        </div>
        <div className="border border-terminal-border rounded px-3 py-2">
          <p className="text-xs font-mono text-terminal-muted">Use Case</p>
          <p className="text-sm font-mono text-terminal-text truncate">{useCaseName}</p>
        </div>
      </div>
    </div>
  );
}

function DocumentSummary({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string;
  const riskTier = data.riskTier as string;
  const documentType = data.documentType as string;
  const sections = (data.sections as Array<{ heading: string }>) ?? [];
  const meta = getDocumentTypeMeta(documentType);

  return (
    <div className="space-y-2">
      <p className="text-sm font-mono text-terminal-text">{title}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <span className={`text-xs font-mono px-2 py-0.5 rounded ${getCategoryBadgeClass(meta.category)}`}>
          {meta.label}
        </span>
        {isGovSecureType(documentType) && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-terminal-green/10 text-terminal-green border border-terminal-green/30">
            {getCategoryLabel(meta.category)}
          </span>
        )}
        <span className="text-xs font-mono px-2 py-0.5 border border-terminal-border rounded">
          {riskTier}
        </span>
        <span className="text-xs font-mono text-terminal-muted">
          {sections.length} sections
        </span>
      </div>
    </div>
  );
}

function PlaybookSummary({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string;
  const framework = data.framework as string;
  const totalDuration = data.totalDuration as string;
  const phases = (data.phases as Array<{ phaseName: string; tasks: unknown[] }>) ?? [];
  const kpis = (data.kpis as unknown[]) ?? [];

  return (
    <div className="space-y-2">
      <p className="text-sm font-mono text-terminal-text">{title}</p>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-mono px-2 py-0.5 border border-terminal-border rounded">
          {framework}
        </span>
        <span className="text-xs font-mono px-2 py-0.5 border border-terminal-border rounded">
          {totalDuration}
        </span>
        <span className="text-xs font-mono text-terminal-muted">
          {phases.length} phases · {phases.reduce((a, p) => a + (p.tasks?.length ?? 0), 0)} tasks · {kpis.length} KPIs
        </span>
      </div>
    </div>
  );
}

function ExportDropdown({ artifactId, title, markdown }: { artifactId: string; title: string; markdown: string }) {
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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-mono text-terminal-muted hover:text-terminal-green transition-colors"
      >
        <FileDown className="w-3 h-3" />
        Export
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-terminal-black border border-terminal-border rounded shadow-lg min-w-[140px]">
            <button
              onClick={() => handleExport('md')}
              className="w-full text-left px-3 py-2 text-xs font-mono text-terminal-muted hover:text-terminal-green hover:bg-terminal-gray/40 transition-colors flex items-center gap-2"
            >
              <Download className="w-3 h-3" />
              Markdown (.md)
            </button>
            <button
              onClick={() => handleExport('docx')}
              disabled={!!exporting}
              className="w-full text-left px-3 py-2 text-xs font-mono text-terminal-muted hover:text-terminal-green hover:bg-terminal-gray/40 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-3 h-3" />
              {exporting === 'docx' ? 'Generating…' : 'Word (.docx)'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
              className="w-full text-left px-3 py-2 text-xs font-mono text-terminal-muted hover:text-terminal-green hover:bg-terminal-gray/40 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <FileDown className="w-3 h-3" />
              {exporting === 'pdf' ? 'Generating…' : 'PDF (.pdf)'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[artifact.type] ?? TYPE_META.document;
  const data = artifact.data as Record<string, unknown>;
  const markdown = (data.markdownExport as string) ?? '';

  return (
    <div className="border border-terminal-green/30 rounded-md overflow-hidden bg-terminal-gray/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-terminal-gray/40 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <span className={`${meta.badge} px-2 py-0.5 rounded text-xs font-mono flex items-center gap-1.5`}>
            {meta.icon}
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {markdown && (
            <ExportDropdown
              artifactId={artifact.id}
              title={(data.title as string) ?? artifact.type}
              markdown={markdown}
            />
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-mono text-terminal-muted hover:text-terminal-green transition-colors"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3">
        {artifact.type === 'intake' && <IntakeSummary data={data} />}
        {artifact.type === 'document' && <DocumentSummary data={data} />}
        {artifact.type === 'playbook' && <PlaybookSummary data={data} />}
      </div>

      {/* Expanded markdown */}
      {expanded && markdown && (
        <div className="px-4 py-3 border-t border-terminal-border">
          <pre className="text-xs font-mono text-terminal-muted whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {markdown}
          </pre>
        </div>
      )}
    </div>
  );
}