'use client';

import { FileText, ClipboardCheck, BookOpen, ArrowUpRight } from 'lucide-react';
import { getDocumentTypeMeta } from '../documentTypeMeta';
import { artifactTitle, type ActiveArtifact } from './DocumentPanel';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  intake: <ClipboardCheck className="h-5 w-5" />,
  document: <FileText className="h-5 w-5" />,
  playbook: <BookOpen className="h-5 w-5" />,
};

const TYPE_LABELS: Record<string, string> = {
  intake: 'Intake Assessment',
  document: 'Governance Document',
  playbook: 'Implementation Playbook',
};

/**
 * Compact in-chat tile for a generated document — the equivalent of Claude's
 * artifact chip. Clicking it opens the document in the console's right panel.
 */
export function ArtifactCard({
  artifact,
  onOpen,
  isOpen,
}: {
  artifact: ActiveArtifact;
  onOpen: (artifact: ActiveArtifact) => void;
  isOpen: boolean;
}) {
  const data = (artifact.data ?? {}) as Record<string, unknown>;
  const documentType = data.documentType as string | undefined;
  const sections = (data.sections as unknown[]) ?? [];
  const riskTier = data.riskTier as string | undefined;
  const typeLabel = documentType
    ? getDocumentTypeMeta(documentType).label
    : TYPE_LABELS[artifact.type] ?? TYPE_LABELS.document;
  const metaBits = [
    typeLabel,
    sections.length > 0 ? `${sections.length} sections` : null,
    riskTier ?? null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onOpen(artifact)}
      aria-pressed={isOpen}
      className={`surface group flex w-full max-w-md items-center gap-3 rounded-xl p-3 text-left transition-colors duration-200 ${
        isOpen ? 'ring-2 ring-terminal-green/40' : 'hover:bg-terminal-gray/60'
      }`}
    >
      <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-terminal-gray text-terminal-muted">
        {TYPE_ICONS[artifact.type] ?? TYPE_ICONS.document}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-terminal-text">
          {artifactTitle(artifact)}
        </span>
        <span className="block truncate text-xs text-terminal-muted">{metaBits.join(' · ')}</span>
      </span>
      <span className="flex flex-none items-center gap-1 text-xs font-medium text-terminal-muted group-hover:text-terminal-text">
        {isOpen ? 'Viewing' : 'Open'}
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
