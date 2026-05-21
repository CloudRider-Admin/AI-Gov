import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink, FileText, ArrowLeft, ShieldCheck } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  fromSlugs,
  getRegulationEntryBySlug,
} from '@/lib/regulations/lookup';
import { getDocumentByCode } from '@/data/govsecureKnowledge';

const PAID_ROLES = new Set(['PRO', 'TEAM', 'ENTERPRISE', 'ADMIN']);

interface PageProps {
  params: Promise<{ reg: string; article: string }>;
}

/**
 * Render the same lightweight markdown subset the inline panel uses.
 * Kept inline (rather than imported from the client component) so this
 * page stays a server component.
 */
function renderBody(markdown: string) {
  const blocks = markdown.split(/\n\s*\n/);

  const renderInline = (text: string, prefix: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${prefix}-${i}`} className="text-terminal-green font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={`${prefix}-${i}`}>{part}</span>;
    });
  };

  return (
    <div className="space-y-4 text-base leading-relaxed font-sans text-terminal-text">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const isBullets = lines.every((l) => l.trim().startsWith('- '));
        if (isBullets) {
          return (
            <ul key={i} className="list-disc pl-6 space-y-2">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^-\s+/, ''), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(block, String(i))}</p>;
      })}
    </div>
  );
}

export default async function RegulationReaderPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/signin?callbackUrl=/govi');
  }
  const role = session.user.role ?? 'FREE';
  if (!PAID_ROLES.has(role)) {
    redirect('/pricing?from=regulations');
  }

  const { reg, article } = await params;
  const entry = getRegulationEntryBySlug(reg, article);

  // For curated entries we render the rich page. If no curated entry,
  // fall back to a shell that points the user back to the inline reader
  // (which will trigger the LLM fallback path through the API).
  if (!entry) {
    const display = fromSlugs(reg, article);
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text px-4 py-10 md:py-16">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/govi"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-terminal-muted hover:text-terminal-green transition-colors mb-6"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Govi
          </Link>
          <h1 className="font-mono text-xs uppercase tracking-wider text-terminal-green mb-2">
            {display.regulation} · {display.article}
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold mb-6">
            No curated explainer yet
          </h2>
          <p className="text-terminal-text font-sans leading-relaxed">
            We haven&apos;t curated an explainer for this provision. In a Govi
            chat, click the regulation card and Govi will generate a tailored
            explainer grounded in your conversation. The standalone page is
            available only for curated entries today.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text px-4 py-10 md:py-16">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-10">
        {/* Main content */}
        <article>
          <Link
            href="/govi"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-terminal-muted hover:text-terminal-green transition-colors mb-6"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Govi
          </Link>
          <p className="font-mono text-xs uppercase tracking-wider text-terminal-green mb-2">
            {entry.regulation} · {entry.article}
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mb-6 leading-tight">
            {entry.title}
          </h1>
          {renderBody(entry.body)}
        </article>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-10 self-start">
          {entry.officialUrl && (
            <a
              href={entry.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-terminal-green/40 rounded-xl p-4 hover:bg-terminal-green/5 transition-colors"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-terminal-muted mb-1">
                Official source
              </p>
              <p className="font-mono text-xs text-terminal-green flex items-center gap-1.5 break-all">
                {entry.officialUrl.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3 shrink-0" />
              </p>
            </a>
          )}

          {entry.relatedGovSecureCodes && entry.relatedGovSecureCodes.length > 0 && (
            <div className="border border-terminal-border rounded-xl p-4 bg-terminal-gray/20">
              <p className="font-mono text-[10px] uppercase tracking-wider text-terminal-muted mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" /> Related GovSecure templates
              </p>
              <ul className="space-y-2">
                {entry.relatedGovSecureCodes
                  .map((code) => ({ code, doc: getDocumentByCode(code) }))
                  .filter((x) => x.doc)
                  .map(({ code, doc }) => (
                    <li key={code} className="text-xs font-sans text-terminal-text">
                      <Link
                        href={`/govi/library?doc=${encodeURIComponent(code)}`}
                        className="flex items-start gap-2 hover:text-terminal-green transition-colors"
                      >
                        <FileText className="w-3 h-3 mt-0.5 text-terminal-green/70 shrink-0" aria-hidden="true" />
                        <span>
                          {doc!.title}
                          <span className="block font-mono text-[10px] text-terminal-muted">
                            {code}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {entry.nistMappings && entry.nistMappings.length > 0 && (
            <div className="border border-terminal-border rounded-xl p-4 bg-terminal-gray/20">
              <p className="font-mono text-[10px] uppercase tracking-wider text-terminal-muted mb-3">
                NIST AI RMF mapping
              </p>
              <div className="flex flex-wrap gap-1.5">
                {entry.nistMappings.map((m) => (
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
        </aside>
      </div>
    </main>
  );
}

export const dynamic = 'force-dynamic'; // session-gated
