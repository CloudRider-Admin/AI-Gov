'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Database,
  RefreshCw,
  AlertTriangle,
  Zap,
  Upload,
  Circle,
  Shield,
  Scale,
  Layers,
  Search,
  Send,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppPage, PageHeader, Panel, timeAgo } from '@/components/app';

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  source: string | null;
  sourceType: string | null;
  embeddedAt: string | null;
  updatedAt: string;
}

interface KnowledgeEntryFull extends KnowledgeEntry {
  content: string;
  isActive: boolean;
}

interface AdminOverview {
  systemStatus: 'operational' | 'degraded' | 'down';
  compliance: { score: number };
}

const CATEGORIES = ['framework', 'regulation', 'best-practice', 'template', 'case-study', 'other'];
const SOURCE_TYPES = ['manual', 'sector', 'regulation', 'nist', 'static'] as const;

// Smart matcher: searches title + source + tags for any of the given needles.
function entryMatches(entry: KnowledgeEntry, needles: string[]): boolean {
  const haystack = [
    entry.title,
    entry.source ?? '',
    entry.sourceType ?? '',
    entry.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return needles.some((n) => haystack.includes(n.toLowerCase()));
}

interface FilterChip {
  key: string;
  label: string;
  matches: (e: KnowledgeEntry) => boolean;
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all',     label: 'All Assets',    matches: () => true },
  { key: 'nist',    label: 'NIST AI RMF',   matches: (e) => entryMatches(e, ['nist']) },
  { key: 'eu-ai',   label: 'EU AI Act',     matches: (e) => entryMatches(e, ['eu ai act', 'ai act']) },
  { key: 'iso',     label: 'ISO/IEC 42001', matches: (e) => entryMatches(e, ['iso/iec 42001', 'iso 42001', '42001']) },
  { key: 'gdpr',    label: 'GDPR',          matches: (e) => entryMatches(e, ['gdpr', 'general data protection']) },
];

const FEATURED_CARDS: Array<{
  key: string;
  title: string;
  description: string;
  tag: string;
  icon: typeof Shield;
  accent: 'green' | 'amber' | 'neutral';
  filterChipKey: string;
  matches: (e: KnowledgeEntry) => boolean;
  query: string;
}> = [
  {
    key: 'nist',
    title: 'AI Risk Management Framework',
    description:
      'Foundational guidelines for managing risks that can affect individuals, organizations, and society during the AI lifecycle.',
    tag: 'NIST 800-53',
    icon: Shield,
    accent: 'green',
    filterChipKey: 'nist',
    matches: (e) => entryMatches(e, ['nist']),
    query: 'NIST AI RMF',
  },
  {
    key: 'eu-ai',
    title: 'EU AI Act Compliance Guide',
    description:
      'Comprehensive breakdown of high-risk systems, transparency obligations, and prohibited AI practices under new EU law.',
    tag: 'REGULATION',
    icon: Scale,
    accent: 'amber',
    filterChipKey: 'eu-ai',
    matches: (e) => entryMatches(e, ['eu ai act', 'ai act']),
    query: 'EU AI Act',
  },
  {
    key: 'data-lineage',
    title: 'Data Lineage & Governance',
    description:
      'Protocols for maintaining audit trails of training data and ensuring provenance throughout the machine learning pipeline.',
    tag: 'TECHNICAL',
    icon: Layers,
    accent: 'neutral',
    filterChipKey: 'all',
    matches: (e) => entryMatches(e, ['lineage', 'provenance', 'data governance', 'data protection']),
    query: 'data lineage and governance',
  },
];

interface FormState {
  title: string;
  content: string;
  category: string;
  tags: string;
  source: string;
  sourceType: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  content: '',
  category: 'framework',
  tags: '',
  source: '',
  sourceType: 'manual',
};

const POLL_MS = 60_000;

export default function AdminKnowledgePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [govPrompt, setGovPrompt] = useState('');

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [showManage, setShowManage] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [embedding, setEmbedding] = useState(false);
  const [embedResult, setEmbedResult] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const fetchEntries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge');
      if (!res.ok) throw new Error('Failed to load entries');
      const data = await res.json();
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (!res.ok) return;
      setOverview(await res.json());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchOverview();
    const id = setInterval(() => {
      fetchEntries(true);
      fetchOverview();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchEntries, fetchOverview]);

  const visibleEntries = useMemo(() => {
    const chip = FILTER_CHIPS.find((c) => c.key === activeFilter) ?? FILTER_CHIPS[0];
    let list = entries.filter(chip.matches);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)) ||
          (e.source ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, activeFilter, searchQuery]);

  const featuredCounts = useMemo(
    () => Object.fromEntries(FEATURED_CARDS.map((c) => [c.key, entries.filter(c.matches).length])),
    [entries],
  );

  const latestPatch = useMemo(() => {
    if (!entries.length) return null;
    const sorted = [...entries].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted[0];
  }, [entries]);

  const embeddedCount = entries.filter((e) => e.embeddedAt).length;
  const unembeddedCount = entries.filter((e) => !e.embeddedAt).length;

  const statusLabel =
    overview?.systemStatus === 'degraded'
      ? 'Degraded'
      : overview?.systemStatus === 'down'
      ? 'Offline'
      : 'All Systems Nominal';
  const statusTone =
    overview?.systemStatus === 'degraded'
      ? 'text-terminal-amber'
      : overview?.systemStatus === 'down'
      ? 'text-terminal-red'
      : 'text-terminal-green';

  // ── CRUD handlers ──────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
    setShowManage(true);
  };

  const openEdit = async (id: string) => {
    setFormError(null);
    try {
      const res = await fetch(`/api/knowledge/${id}`);
      if (!res.ok) throw new Error('Failed to load entry');
      const entry: KnowledgeEntryFull = await res.json();
      setForm({
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags.join(', '),
        source: entry.source ?? '',
        sourceType: entry.sourceType ?? 'manual',
      });
      setEditingId(id);
      setShowForm(true);
      setShowManage(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entry');
    }
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Title and content are required.');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      source: form.source.trim() || undefined,
      sourceType: form.sourceType,
    };
    try {
      const res = editingId
        ? await fetch(`/api/knowledge/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Save failed');
      }
      setShowForm(false);
      await fetchEntries();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to delete entry');
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete entry');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEmbedAll = async () => {
    setEmbedding(true);
    setEmbedResult(null);
    try {
      const res = await fetch('/api/knowledge/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Embedding failed');
      setEmbedResult(data.message);
      await fetchEntries();
    } catch (e) {
      setEmbedResult(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setEmbedding(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch('/api/knowledge/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Seed failed');
      setSeedResult(data.message);
      await fetchEntries();
    } catch (e) {
      setSeedResult(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setSeeding(false);
    }
  };

  const complianceScore = overview?.compliance.score ?? null;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Platform / Admin"
        title="Knowledge base"
        description="The governance entries, regulatory standards, and compliance blueprints Govi retrieves from when answering."
        actions={
          <span className={`inline-flex items-center gap-2 font-mono text-xs ${statusTone}`}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {statusLabel}
          </span>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 text-sm text-terminal-red">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* ── Search + latest change ────────────────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Search the registry" padded>
          <label className="relative mb-4 block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-terminal-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Query regulatory frameworks, NIST controls, or ISO standards…"
              className="w-full rounded-md border border-terminal-border bg-terminal-gray/30 py-3 pl-11 pr-4 text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:ring-2 focus:ring-terminal-green/30"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setActiveFilter(chip.key)}
                className={`rounded-full px-3 py-1.5 font-mono text-xs transition-colors ${
                  activeFilter === chip.key
                    ? 'bg-terminal-green font-semibold text-terminal-black'
                    : 'border border-terminal-border text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terminal-green" aria-hidden="true" />
              Latest change
            </span>
          }
          padded
        >
          {latestPatch ? (
            <>
              <p className="font-sans text-sm leading-relaxed text-terminal-text">
                {latestPatch.title}
              </p>
              <p className="mt-2 font-mono text-xs text-terminal-muted">
                <span className="text-terminal-green">{latestPatch.sourceType ?? 'manual'}</span> ·
                updated {timeAgo(latestPatch.updatedAt)}
              </p>
            </>
          ) : (
            <p className="text-sm text-terminal-muted">Awaiting first knowledge entry.</p>
          )}
        </Panel>
      </div>

      {/* ── Featured framework cards ──────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4">
        {FEATURED_CARDS.map((card) => {
          const count = featuredCounts[card.key] ?? 0;
          const Icon = card.icon;
          const bg =
            card.accent === 'green'
              ? 'bg-terminal-green/15'
              : card.accent === 'amber'
              ? 'bg-terminal-amber/15'
              : 'bg-terminal-gray';
          const iconColor =
            card.accent === 'green'
              ? 'text-terminal-green'
              : card.accent === 'amber'
              ? 'text-terminal-amber'
              : 'text-terminal-muted';
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setActiveFilter(card.filterChipKey);
                setSearchQuery('');
                setShowManage(true);
              }}
              className="glass flex flex-col rounded-xl p-4 text-left transition-all duration-300 hover:-translate-y-px hover:border-terminal-green/40"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
                </span>
                <span className="rounded-md bg-terminal-gray px-2 py-1 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  {card.tag}
                </span>
              </div>
              <h3 className="mb-2 font-mono text-sm font-bold leading-tight text-terminal-text">
                {card.title}
              </h3>
              <p className="mb-4 flex-1 font-sans text-sm leading-relaxed text-terminal-muted">
                {card.description}
              </p>
              <div className="border-t border-terminal-border pt-3 font-mono text-xs text-terminal-muted">
                <span className="font-semibold tabular-nums text-terminal-text">{count}</span>{' '}
                {count === 1 ? 'entry' : 'entries'}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Master Blueprint + Ask Govi ───────────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="ISO/IEC 42001 certification path" padded>
          <div className="grid items-center gap-6 md:grid-cols-2">
            <div>
              <p className="mb-4 font-sans text-sm leading-relaxed text-terminal-muted">
                Step-by-step implementation of the international standard for AI Management Systems
                (AIMS) — the certification route for enterprise auditing.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setActiveFilter('iso');
                    setSearchQuery('');
                    setShowManage(true);
                  }}
                  className="btn-primary py-2 text-sm"
                >
                  Open ISO entries
                </button>
                <Link href="/topics" className="btn-tertiary text-sm">
                  Full syllabus <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Embedding readout — the same metric the admin overview shows. */}
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-terminal-gray/30">
              <div className="absolute inset-6 rounded-xl border border-terminal-border/60 bg-dot-pattern bg-dots opacity-50" />
              <div className="absolute right-4 top-4 rounded-md bg-terminal-dark/80 px-3 py-2">
                <div className="font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  Embedding coverage
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums text-terminal-green">
                  {complianceScore !== null ? `${complianceScore.toFixed(1)}%` : '—'}
                </div>
              </div>
              <Database className="h-16 w-16 text-terminal-muted/40" aria-hidden="true" />
            </div>
          </div>
        </Panel>

        {/* Ask Govi CTA */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = govPrompt.trim() || 'Explain GDPR Article 22';
            router.push(`/govi?q=${encodeURIComponent(q)}`);
          }}
          className="flex flex-col justify-between rounded-xl bg-terminal-green p-6 text-terminal-black transition-all hover:brightness-95 lg:col-span-2"
        >
          <div>
            <Sparkles className="mb-3 h-6 w-6" aria-hidden="true" />
            <h2 className="font-mono text-xl font-bold leading-tight">
              Ask Govi anything about compliance.
            </h2>
          </div>
          <label className="mt-6 flex items-center gap-2 rounded-md bg-terminal-black/20 px-3 py-2.5 text-sm focus-within:ring-2 focus-within:ring-terminal-black/40">
            <input
              value={govPrompt}
              onChange={(e) => setGovPrompt(e.target.value)}
              placeholder="Explain GDPR Article 22…"
              aria-label="Ask Govi"
              className="flex-1 bg-transparent text-terminal-black placeholder:text-terminal-black/60 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send prompt to Govi"
              className="text-terminal-black hover:opacity-80"
            >
              <Send className="h-4 w-4" />
            </button>
          </label>
        </form>
      </div>

      {/* ── Recent Intelligence Updates table ────────────────────── */}
      <Panel
        title="Recent entries"
        action={
          <button
            onClick={() => setShowManage((s) => !s)}
            className="inline-flex items-center gap-1 text-terminal-green hover:underline"
          >
            {showManage ? 'Hide archive' : 'View archive'} <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        {loading && visibleEntries.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-terminal-muted">Loading entries…</p>
        ) : visibleEntries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Database className="mx-auto mb-4 h-10 w-10 text-terminal-muted" aria-hidden="true" />
            <p className="mb-6 text-sm text-terminal-muted">
              {activeFilter === 'all' ? 'No knowledge entries yet.' : `No ${activeFilter} entries.`}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={openCreate} className="btn-primary py-2 text-sm">
                <Plus className="h-4 w-4" /> Add entry
              </button>
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="btn-secondary py-2 text-sm disabled:opacity-50"
              >
                {seeding ? 'Seeding…' : 'Seed static data'}
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-terminal-border bg-terminal-gray/30 font-mono text-xs uppercase tracking-wider text-terminal-muted">
                  <th className="px-4 py-2.5 font-semibold">Entry</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Category</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Retrieval</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.slice(0, 8).map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-terminal-border/50 transition-colors duration-300 last:border-b-0 hover:bg-terminal-gray/30"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2.5">
                        <Circle
                          className={`mt-1.5 h-2 w-2 shrink-0 ${
                            entry.embeddedAt
                              ? 'fill-terminal-green text-terminal-green'
                              : 'fill-terminal-amber text-terminal-amber'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-terminal-text">{entry.title}</div>
                          {entry.source && (
                            <div className="font-mono text-xs text-terminal-muted">{entry.source}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top sm:table-cell">
                      <span className="rounded-md bg-terminal-gray px-2 py-1 font-mono text-xs text-terminal-muted">
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          entry.embeddedAt ? 'text-terminal-green' : 'text-terminal-amber'
                        }`}
                      >
                        {entry.embeddedAt ? 'Embedded' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Admin management toolbar (always visible, compact) ───── */}
      <Panel
        title="Registry operations"
        action={
          <span className="text-terminal-muted">
            <span className="font-semibold tabular-nums text-terminal-text">{entries.length}</span>{' '}
            entries ·{' '}
            <span className="font-semibold tabular-nums text-terminal-green">{embeddedCount}</span>{' '}
            embedded ·{' '}
            <span
              className={`font-semibold tabular-nums ${
                unembeddedCount > 0 ? 'text-terminal-amber' : 'text-terminal-text'
              }`}
            >
              {unembeddedCount}
            </span>{' '}
            pending
          </span>
        }
        padded
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-terminal-green px-3 py-2 font-mono text-xs font-semibold text-terminal-black hover:bg-terminal-green/90"
          >
            <Plus className="h-3.5 w-3.5" /> New entry
          </button>
          <button
            onClick={handleEmbedAll}
            disabled={embedding}
            className="inline-flex items-center gap-1.5 rounded-md border border-terminal-cyan/50 px-3 py-2 font-mono text-xs text-terminal-cyan hover:bg-terminal-cyan/10 disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5" /> {embedding ? 'Embedding…' : 'Embed all'}
          </button>
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 rounded-md border border-terminal-amber/50 px-3 py-2 font-mono text-xs text-terminal-amber hover:bg-terminal-amber/10 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> {seeding ? 'Seeding…' : 'Seed static'}
          </button>
          <button
            onClick={() => fetchEntries()}
            className="inline-flex items-center gap-1.5 rounded-md border border-terminal-border px-3 py-2 font-mono text-xs text-terminal-muted hover:text-terminal-text"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {(embedResult || seedResult) && (
          <div className="mt-3 space-y-2">
            {embedResult && (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  embedResult.startsWith('Error')
                    ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'
                    : 'border-terminal-cyan/40 bg-terminal-cyan/10 text-terminal-cyan'
                }`}
              >
                <Zap className="h-3.5 w-3.5" /> {embedResult}
              </div>
            )}
            {seedResult && (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  seedResult.startsWith('Error')
                    ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'
                    : 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'
                }`}
              >
                <Upload className="h-3.5 w-3.5" /> {seedResult}
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* ── Entry editor form (modal-ish inline panel) ──────────── */}
      {showForm && (
        <Panel
          title={editingId ? 'Edit entry' : 'New entry'}
          action={
            <button
              onClick={() => setShowForm(false)}
              className="text-terminal-muted hover:text-terminal-text"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          }
          padded
        >
          {formError && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
              <AlertTriangle className="h-3.5 w-3.5" /> {formError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. EU AI Act High-Risk Requirements"
                className="input-field"
              />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="input-field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Source Type</Label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}
                className="input-field"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Source (provenance)</Label>
              <input
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="e.g. NIST AI RMF 1.0"
                className="input-field"
              />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="GDPR, privacy, data protection"
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <Label>
                Content
                <span className="ml-2 normal-case text-terminal-muted">
                  {form.content.length.toLocaleString()} chars
                </span>
              </Label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={8}
                placeholder="Paste the knowledge content here. This text will be embedded into Govi's context when answering related queries."
                className="input-field resize-y"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-terminal-border px-3 py-2 font-mono text-xs text-terminal-muted hover:text-terminal-text"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-terminal-green px-3 py-2 font-mono text-xs font-semibold text-terminal-black hover:bg-terminal-green/90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </Panel>
      )}

      {/* ── Expanded archive (full CRUD list) ─────────────────────── */}
      {showManage && (
        <Panel
          title={`Archive · ${visibleEntries.length} entries`}
          action={<span className="text-terminal-muted">filter: {activeFilter}</span>}
        >
          <div className="divide-y divide-terminal-border">
            {visibleEntries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-4 p-4 group">
                <Circle
                  className={`w-2.5 h-2.5 mt-1.5 shrink-0 ${
                    entry.embeddedAt
                      ? 'fill-terminal-green text-terminal-green'
                      : 'fill-terminal-muted/30 text-terminal-muted/30'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-terminal-text">{entry.title}</span>
                    <span className="rounded-md border border-terminal-border px-2 py-0.5 font-mono text-xs text-terminal-muted">
                      {entry.category}
                    </span>
                    {entry.sourceType && entry.sourceType !== 'manual' && (
                      <span className="rounded-md bg-terminal-cyan/10 px-2 py-0.5 font-mono text-xs text-terminal-cyan">
                        {entry.sourceType}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.tags.map((tag, idx) => (
                      <span
                        key={`${tag}-${idx}`}
                        className="rounded-md bg-terminal-green/10 px-1.5 py-0.5 font-mono text-xs text-terminal-green"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 font-mono text-xs text-terminal-muted">
                    updated {timeAgo(entry.updatedAt)}
                    {entry.source && ` · ${entry.source}`}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => openEdit(entry.id)}
                    className="p-2 rounded text-terminal-muted hover:text-terminal-green hover:bg-terminal-green/10"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="p-2 rounded text-terminal-muted hover:text-terminal-red hover:bg-terminal-red/10 disabled:opacity-40"
                    title="Deactivate"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {visibleEntries.length === 0 && (
              <div className="p-8 text-center text-sm text-terminal-muted">No entries match.</div>
            )}
          </div>
        </Panel>
      )}
    </AppPage>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-terminal-muted">
      {children}
    </label>
  );
}
