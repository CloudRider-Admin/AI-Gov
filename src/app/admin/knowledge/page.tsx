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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

const POLL_MS = 30_000;

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

  const fetchEntries = useCallback(async () => {
    setLoading(true);
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
      fetchEntries();
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
      await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('Failed to delete entry');
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
    <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto font-mono space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-terminal-green mb-3">
            Intelligence Registry
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-terminal-text tracking-tight mb-3">
            Knowledge Base
          </h1>
          <p className="text-sm text-terminal-muted max-w-2xl leading-relaxed">
            A sovereign repository of technical frameworks, regulatory standards, and compliance
            blueprints for secure AI governance.
          </p>
        </div>

        <div className="rounded-xl border border-terminal-border bg-terminal-black px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted mb-1">Status</div>
          <div className={`flex items-center gap-2 ${statusTone}`}>
            <ShieldCheck className="w-4 h-4" />
            <span className="text-sm font-semibold">{statusLabel}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* ── Search + Latest Patch row ─────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-terminal-border bg-terminal-black p-5">
          <label className="relative block mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Query regulatory frameworks, NIST controls, or ISO standards…"
              className="w-full rounded-xl bg-terminal-gray pl-11 pr-4 py-3 text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:ring-2 focus:ring-terminal-green/30"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setActiveFilter(chip.key)}
                className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                  activeFilter === chip.key
                    ? 'bg-terminal-green text-terminal-black font-semibold'
                    : 'border border-terminal-border text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Latest Patch dark card */}
        <div className="rounded-xl p-5 flex flex-col justify-between" style={{ backgroundColor: '#0f1012' }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-2">Latest Patch</div>
            {latestPatch ? (
              <p className="text-xs text-white/90 leading-relaxed">
                <span className="text-terminal-green">{latestPatch.sourceType ?? 'manual'}</span>{' '}
                deployment: {latestPatch.title}
              </p>
            ) : (
              <p className="text-xs text-white/60">Awaiting first knowledge entry.</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-terminal-green">Live Feed</span>
          </div>
        </div>
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
              className="text-left rounded-xl border border-terminal-border bg-terminal-black p-5 hover:border-terminal-green/40 transition-colors flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-md bg-terminal-gray text-terminal-muted">
                  {card.tag}
                </span>
              </div>
              <h3 className="text-lg font-bold text-terminal-text leading-tight mb-2">{card.title}</h3>
              <p className="text-xs text-terminal-muted leading-relaxed mb-5 flex-1">
                {card.description}
              </p>
              <div className="pt-4 border-t border-terminal-border flex items-center justify-between">
                <div className="flex -space-x-2">
                  {Array.from({ length: Math.min(3, Math.max(1, count)) }).map((_, i) => (
                    <span
                      key={i}
                      className="w-6 h-6 rounded-full bg-terminal-gray border border-terminal-black"
                    />
                  ))}
                </div>
                <span className="text-xs text-terminal-muted">
                  {count} {count === 1 ? 'article' : 'articles'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Master Blueprint + Ask Govi ───────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl border border-terminal-border bg-terminal-black p-6 grid md:grid-cols-2 gap-6 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-terminal-green text-terminal-black text-[10px] uppercase tracking-[0.18em] font-semibold mb-4">
              Master Blueprint
            </span>
            <h3 className="text-2xl font-bold text-terminal-text leading-tight mb-3">
              ISO/IEC 42001 Certification Path
            </h3>
            <p className="text-xs text-terminal-muted leading-relaxed mb-5">
              Step-by-step technical implementation of the international standard for AI Management
              Systems (AIMS). Essential for enterprise-level sovereign auditing.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setActiveFilter('iso');
                  setSearchQuery('');
                  setShowManage(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-terminal-green text-terminal-black text-xs font-semibold rounded-xl hover:bg-terminal-green/90 transition-colors"
              >
                Start Blueprint
              </button>
              <Link
                href="/topics"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-terminal-text hover:text-terminal-green transition-colors"
              >
                View Full Syllabus <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Compliance readout block */}
          <div className="relative aspect-square rounded-xl bg-terminal-gray flex items-center justify-center overflow-hidden">
            <div className="absolute inset-6 rounded-xl border border-terminal-border/60 bg-dot-pattern bg-dots opacity-50" />
            <div className="absolute top-4 right-4 rounded-xl bg-terminal-black/80 px-3 py-2">
              <div className="text-[9px] uppercase tracking-[0.18em] text-terminal-muted">Compliance Score</div>
              <div className="text-2xl font-bold text-terminal-green">
                {complianceScore !== null ? `${complianceScore.toFixed(1)}%` : '—'}
              </div>
            </div>
            <Database className="w-16 h-16 text-terminal-muted/40" />
          </div>
        </div>

        {/* Ask Govi AI CTA */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = govPrompt.trim() || 'Explain GDPR Article 22';
            router.push(`/govi?q=${encodeURIComponent(q)}`);
          }}
          className="lg:col-span-2 rounded-xl p-6 bg-terminal-green text-terminal-black flex flex-col justify-between hover:brightness-95 transition-all"
        >
          <div>
            <Sparkles className="w-6 h-6 mb-3" />
            <h3 className="text-2xl font-bold leading-tight">
              Ask Govi AI anything about compliance.
            </h3>
          </div>
          <label className="mt-6 flex items-center gap-2 rounded-xl bg-terminal-black/20 px-3 py-2.5 text-xs focus-within:ring-2 focus-within:ring-terminal-black/40">
            <input
              value={govPrompt}
              onChange={(e) => setGovPrompt(e.target.value)}
              placeholder="Explain GDPR Article 22…"
              aria-label="Ask Govi AI"
              className="flex-1 bg-transparent text-terminal-black placeholder:text-terminal-black/60 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send prompt to Govi"
              className="text-terminal-black hover:opacity-80"
            >
              <Send className="w-4 h-4" />
            </button>
          </label>
        </form>
      </div>

      {/* ── Recent Intelligence Updates table ────────────────────── */}
      <div className="rounded-xl border border-terminal-border bg-terminal-black p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-terminal-text">Recent Intelligence Updates</h3>
          <button
            onClick={() => setShowManage((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-terminal-green hover:underline"
          >
            {showManage ? 'Hide Archive' : 'View Archive'} <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading && visibleEntries.length === 0 ? (
          <div className="py-8 text-center text-sm text-terminal-muted">Loading intelligence feed…</div>
        ) : visibleEntries.length === 0 ? (
          <div className="py-8 text-center">
            <Database className="w-8 h-8 text-terminal-muted mx-auto mb-3" />
            <p className="text-sm text-terminal-muted mb-4">
              {activeFilter === 'all' ? 'No knowledge entries yet.' : `No ${activeFilter} entries.`}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={openCreate}
                className="text-xs border border-terminal-green text-terminal-green px-3 py-1.5 rounded-xl hover:bg-terminal-green/10"
              >
                Add Entry
              </button>
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="text-xs border border-terminal-amber/50 text-terminal-amber px-3 py-1.5 rounded-xl hover:bg-terminal-amber/10 disabled:opacity-50"
              >
                {seeding ? 'Seeding…' : 'Seed Static Data'}
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted border-b border-terminal-border">
                  <th className="text-left font-normal py-3 pr-4">Resource Thread</th>
                  <th className="text-left font-normal py-3 pr-4">Category</th>
                  <th className="text-right font-normal py-3">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {visibleEntries.slice(0, 8).map((entry) => (
                  <tr key={entry.id} className="group">
                    <td className="py-4 pr-4 align-top">
                      <div className="flex items-start gap-2.5">
                        <Circle
                          className={`w-2 h-2 mt-1.5 shrink-0 ${
                            entry.embeddedAt
                              ? 'fill-terminal-green text-terminal-green'
                              : 'fill-terminal-muted/40 text-terminal-muted/40'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-terminal-text truncate">{entry.title}</div>
                          {entry.source && (
                            <div className="text-[11px] text-terminal-muted mt-0.5">
                              {entry.source}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-md bg-terminal-gray text-terminal-muted">
                        {entry.category}
                      </span>
                    </td>
                    <td className="py-4 text-right align-top">
                      <span
                        className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
                          entry.embeddedAt ? 'text-terminal-green' : 'text-terminal-amber'
                        }`}
                      >
                        {entry.embeddedAt ? 'Signed by Seal' : 'Pending Review'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Admin management toolbar (always visible, compact) ───── */}
      <div className="rounded-xl border border-terminal-border bg-terminal-black p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-terminal-text uppercase tracking-wider">
              Registry Operations
            </h3>
            <p className="text-xs text-terminal-muted mt-1">
              {entries.length} entries · {embeddedCount} embedded · {unembeddedCount} pending
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-terminal-amber/50 text-terminal-amber rounded-xl hover:bg-terminal-amber/10 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" /> {seeding ? 'Seeding…' : 'Seed Static'}
            </button>
            <button
              onClick={handleEmbedAll}
              disabled={embedding}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-terminal-cyan/50 text-terminal-cyan rounded-xl hover:bg-terminal-cyan/10 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" /> {embedding ? 'Embedding…' : 'Embed All'}
            </button>
            <button
              onClick={fetchEntries}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-terminal-border text-terminal-muted rounded-xl hover:text-terminal-text"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-terminal-green text-terminal-black rounded-xl hover:bg-terminal-green/90"
            >
              <Plus className="w-3.5 h-3.5" /> New Entry
            </button>
          </div>
        </div>

        {(embedResult || seedResult) && (
          <div className="mt-3 space-y-2">
            {embedResult && (
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                  embedResult.startsWith('Error')
                    ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'
                    : 'border-terminal-cyan/40 bg-terminal-cyan/10 text-terminal-cyan'
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> {embedResult}
              </div>
            )}
            {seedResult && (
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                  seedResult.startsWith('Error')
                    ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'
                    : 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> {seedResult}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Entry editor form (modal-ish inline panel) ──────────── */}
      {showForm && (
        <div className="rounded-xl border border-terminal-border bg-terminal-black p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-terminal-text uppercase tracking-wider">
              {editingId ? 'Edit Entry' : 'New Entry'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-terminal-muted hover:text-terminal-text"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-xl border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 text-xs text-terminal-red mb-4">
              <AlertTriangle className="w-3.5 h-3.5" /> {formError}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. EU AI Act High-Risk Requirements"
                className="w-full rounded-xl bg-terminal-gray border border-terminal-border px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:ring-2 focus:ring-terminal-green/30"
              />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl bg-terminal-gray border border-terminal-border px-3 py-2 text-sm text-terminal-text"
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
                className="w-full rounded-xl bg-terminal-gray border border-terminal-border px-3 py-2 text-sm text-terminal-text"
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
                className="w-full rounded-xl bg-terminal-gray border border-terminal-border px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted"
              />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="GDPR, privacy, data protection"
                className="w-full rounded-xl bg-terminal-gray border border-terminal-border px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted"
              />
            </div>
            <div className="md:col-span-2">
              <Label>
                Content
                <span className="ml-2 normal-case text-terminal-muted text-[10px]">
                  {form.content.length.toLocaleString()} chars
                </span>
              </Label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={8}
                placeholder="Paste the knowledge content here. This text will be embedded into Govi's context when answering related queries."
                className="w-full rounded-xl bg-terminal-gray border border-terminal-border px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setShowForm(false)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-terminal-border text-terminal-muted rounded-xl hover:text-terminal-text"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-terminal-green text-terminal-black rounded-xl hover:bg-terminal-green/90 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* ── Expanded archive (full CRUD list) ─────────────────────── */}
      {showManage && (
        <div className="rounded-xl border border-terminal-border bg-terminal-black">
          <div className="flex items-center justify-between p-5 border-b border-terminal-border">
            <h3 className="text-sm font-bold text-terminal-text uppercase tracking-wider">
              Archive · {visibleEntries.length} entries
            </h3>
            <span className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">
              filter: {activeFilter}
            </span>
          </div>
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-terminal-text">{entry.title}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-md border border-terminal-border text-terminal-muted">
                      {entry.category}
                    </span>
                    {entry.sourceType && entry.sourceType !== 'manual' && (
                      <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-md bg-terminal-cyan/10 text-terminal-cyan">
                        {entry.sourceType}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.tags.map((tag, idx) => (
                      <span
                        key={`${tag}-${idx}`}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-green/10 text-terminal-green/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-terminal-muted mt-1">
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
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-[0.18em] text-terminal-muted mb-1.5">
      {children}
    </label>
  );
}