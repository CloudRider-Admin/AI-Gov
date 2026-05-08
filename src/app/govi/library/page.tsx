import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { GOVSECURE_DOCUMENT_LIST, GOVSECURE_GENERATED_AT } from '@/data/govsecureKnowledge';
import type { GovSecureCategory } from '@/types/govsecure';

export const metadata: Metadata = {
  title: 'GovSecure Library — Govi',
  description:
    'Browse the GovSecure Governance Library — policies, checklists, playbooks, and questionnaires that anchor Govi\'s recommendations.',
};

const CATEGORY_ORDER: GovSecureCategory[] = [
  'policies',
  'checklists',
  'playbooks',
  'frameworks',
  'questionnaires',
];

const CATEGORY_LABEL: Record<GovSecureCategory, string> = {
  policies: 'Policies',
  checklists: 'Checklists',
  playbooks: 'Playbooks',
  frameworks: 'Frameworks',
  questionnaires: 'Questionnaires',
};

const CATEGORY_BLURB: Record<GovSecureCategory, string> = {
  policies: 'Board-ready governance policies covering AUP, security, privacy, oversight, and vendor risk',
  checklists: 'Operational checklists used at intake, validation, monitoring, incident, and audit gates',
  playbooks: 'Step-by-step program playbooks (AI Chef stations, 90-Day Blueprint, third-party privacy)',
  frameworks: 'NIST AI RMF / ISO 42001 / EU AI Act crosswalks and responsibility matrices',
  questionnaires: 'TPRM questionnaires and other multi-turn assessment instruments',
};

export default function GovSecureLibraryPage() {
  const grouped = new Map<GovSecureCategory, typeof GOVSECURE_DOCUMENT_LIST>();
  for (const doc of GOVSECURE_DOCUMENT_LIST) {
    const list = grouped.get(doc.category) ?? [];
    list.push(doc);
    grouped.set(doc.category, list);
  }

  return (
    <div className="min-h-screen pt-16 pb-12">
      <div className="border-b border-terminal-border bg-terminal-black/80 backdrop-blur-sm sticky top-16 z-10 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-terminal-green" />
            <div>
              <h1 className="text-sm font-mono font-bold text-terminal-green">
                GovSecure Governance Library
              </h1>
              <p className="text-xs font-mono text-terminal-muted mt-0.5">
                {GOVSECURE_DOCUMENT_LIST.length} documents · indexed {new Date(GOVSECURE_GENERATED_AT).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Link
            href="/govi"
            className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 border border-terminal-border rounded hover:border-terminal-green hover:text-terminal-green transition-colors text-terminal-muted"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Govi
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        <p className="text-sm font-sans text-terminal-muted leading-relaxed">
          Govi grounds every recommendation in this library. Each policy, checklist, and playbook
          below is studied at retrieval time so generated documents inherit GovSecure&apos;s voice,
          structure, and required clauses. The library is read-only — to request a document,
          ask Govi directly or use the action cards in a conversation.
        </p>

        {CATEGORY_ORDER.map((category) => {
          const docs = grouped.get(category) ?? [];
          if (docs.length === 0) return null;
          return (
            <section key={category}>
              <header className="border-b border-terminal-border pb-2 mb-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-mono text-terminal-green text-sm uppercase tracking-wider">
                    {CATEGORY_LABEL[category]}
                  </h2>
                  <span className="text-xs font-mono text-terminal-muted">
                    {docs.length} documents
                  </span>
                </div>
                <p className="text-xs font-sans text-terminal-muted mt-1">
                  {CATEGORY_BLURB[category]}
                </p>
              </header>
              <ul className="space-y-1">
                {docs
                  .slice()
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((doc) => (
                    <li
                      key={doc.documentCode}
                      className="flex items-baseline justify-between gap-3 border border-terminal-border rounded-md px-3 py-2 bg-terminal-gray/20"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-mono text-terminal-text truncate">{doc.title}</p>
                        <p className="text-[10px] font-mono text-terminal-muted">
                          {doc.documentCode} · {doc.subType}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-terminal-muted shrink-0">
                        {doc.format}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
