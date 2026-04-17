'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Check, Database, RefreshCw, AlertTriangle, Zap, Upload, Circle } from 'lucide-react';

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

const CATEGORIES = ['framework', 'regulation', 'best-practice', 'template', 'case-study', 'other'];
const SOURCE_TYPES = ['manual', 'sector', 'regulation', 'nist', 'static'] as const;
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'manual', label: 'Manual' },
  { key: 'sector', label: 'Sector' },
  { key: 'regulation', label: 'Regulation' },
  { key: 'nist', label: 'NIST' },
  { key: 'static', label: 'Static' },
] as const;

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

const EMPTY_FORM: FormState = { title: '', content: '', category: 'framework', tags: '', source: '', sourceType: 'manual' };

export default function AdminKnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');

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
      const url = activeTab === 'all' ? '/api/knowledge' : `/api/knowledge?sourceType=${activeTab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load entries');
      const data = await res.json();
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
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
      const res = await fetch('/api/knowledge/embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
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

  const embeddedCount = entries.filter((e) => e.embeddedAt).length;
  const unembeddedCount = entries.filter((e) => !e.embeddedAt).length;

  return (
    <div className="min-h-screen px-4 py-20 font-mono">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-5 h-5 text-terminal-green" />
              <h1 className="text-2xl font-bold text-terminal-green">Knowledge Base</h1>
              <span className="text-xs text-terminal-muted border border-terminal-border px-2 py-0.5 rounded">ADMIN</span>
            </div>
            <p className="text-sm text-terminal-muted">
              Manage RAG knowledge entries that ground Govi&apos;s AI responses.
              {embeddedCount > 0 && (
                <span className="ml-2 text-terminal-green/70">
                  {embeddedCount} embedded · {unembeddedCount} pending
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-terminal-amber/50 text-terminal-amber rounded hover:bg-terminal-amber/10 transition-colors disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {seeding ? 'Seeding…' : 'Seed Static Data'}
            </button>
            <button
              onClick={handleEmbedAll}
              disabled={embedding}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-blue-400/50 text-blue-400 rounded hover:bg-blue-400/10 transition-colors disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {embedding ? 'Embedding…' : 'Embed All'}
            </button>
            <button
              onClick={fetchEntries}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-terminal-border rounded text-terminal-muted hover:border-terminal-green hover:text-terminal-green transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-terminal-green text-terminal-green rounded hover:bg-terminal-green/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Entry
            </button>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 border border-red-500/40 rounded bg-red-500/10 text-red-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {embedResult && (
          <div className={`flex items-center gap-2 p-3 mb-4 border rounded text-xs ${embedResult.startsWith('Error') ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-blue-400/40 bg-blue-400/10 text-blue-400'}`}>
            <Zap className="w-4 h-4 shrink-0" />
            {embedResult}
          </div>
        )}
        {seedResult && (
          <div className={`flex items-center gap-2 p-3 mb-4 border rounded text-xs ${seedResult.startsWith('Error') ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'}`}>
            <Upload className="w-4 h-4 shrink-0" />
            {seedResult}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 border-b border-terminal-border pb-2 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                activeTab === tab.key
                  ? 'bg-terminal-green/10 text-terminal-green border border-terminal-green/30 border-b-transparent'
                  : 'text-terminal-muted hover:text-terminal-green'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Create / Edit form */}
        {showForm && (
          <div className="mb-8 terminal-window">
            <div className="terminal-header">
              <div className="terminal-dot bg-red-500" />
              <div className="terminal-dot bg-yellow-500" />
              <div className="terminal-dot bg-green-500" />
              <span className="ml-4 text-xs text-terminal-muted">
                {editingId ? 'edit_entry.sh' : 'new_entry.sh'}
              </span>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 border border-red-500/40 rounded bg-red-500/10 text-red-400 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-terminal-muted uppercase tracking-wider mb-1">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. EU AI Act High-Risk Requirements"
                    className="w-full bg-terminal-black border border-terminal-border rounded px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted/40 focus:outline-none focus:border-terminal-green"
                  />
                </div>

                <div>
                  <label className="block text-xs text-terminal-muted uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full bg-terminal-black border border-terminal-border rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-green"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-terminal-muted uppercase tracking-wider mb-1">Source Type</label>
                  <select
                    value={form.sourceType}
                    onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}
                    className="w-full bg-terminal-black border border-terminal-border rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-green"
                  >
                    {SOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-terminal-muted uppercase tracking-wider mb-1">
                    Source <span className="normal-case text-terminal-muted/60">(provenance)</span>
                  </label>
                  <input
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    placeholder="e.g. NIST AI RMF 1.0"
                    className="w-full bg-terminal-black border border-terminal-border rounded px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted/40 focus:outline-none focus:border-terminal-green"
                  />
                </div>

                <div>
                  <label className="block text-xs text-terminal-muted uppercase tracking-wider mb-1">
                    Tags <span className="normal-case text-terminal-muted/60">(comma-separated)</span>
                  </label>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    placeholder="GDPR, privacy, data protection"
                    className="w-full bg-terminal-black border border-terminal-border rounded px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted/40 focus:outline-none focus:border-terminal-green"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-terminal-muted uppercase tracking-wider mb-1">
                    Content
                    <span className="normal-case text-terminal-muted/60 ml-2">{form.content.length.toLocaleString()} chars</span>
                  </label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    rows={10}
                    placeholder="Paste the knowledge content here. This text will be embedded into Govi's context when answering related queries."
                    className="w-full bg-terminal-black border border-terminal-border rounded px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted/40 focus:outline-none focus:border-terminal-green resize-y"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs border border-terminal-border rounded text-terminal-muted hover:border-terminal-green transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs border border-terminal-green text-terminal-green rounded hover:bg-terminal-green/10 transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saving ? 'Saving…' : editingId ? 'Update Entry' : 'Create Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entries table */}
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500" />
            <div className="terminal-dot bg-yellow-500" />
            <div className="terminal-dot bg-green-500" />
            <span className="ml-4 text-xs text-terminal-muted">knowledge_entries.db</span>
            <span className="ml-auto mr-4 text-xs text-terminal-muted/60">{entries.length} entries</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-terminal-muted text-sm">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <Database className="w-10 h-10 text-terminal-muted mx-auto mb-3" />
              <p className="text-terminal-muted text-sm mb-4">
                {activeTab === 'all' ? 'No knowledge entries yet.' : `No ${activeTab} entries yet.`}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={openCreate}
                  className="text-xs border border-terminal-green text-terminal-green px-4 py-2 rounded hover:bg-terminal-green/10 transition-colors"
                >
                  Add your first entry
                </button>
                <button
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="text-xs border border-terminal-amber/50 text-terminal-amber px-4 py-2 rounded hover:bg-terminal-amber/10 transition-colors disabled:opacity-50"
                >
                  {seeding ? 'Seeding…' : 'Seed static data'}
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-terminal-border">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 p-4 hover:bg-terminal-gray/20 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Embedded status indicator */}
                      <span title={entry.embeddedAt ? `Embedded ${timeAgo(entry.embeddedAt)}` : 'Not embedded'}>
                        <Circle
                          className={`w-2.5 h-2.5 shrink-0 ${entry.embeddedAt ? 'fill-terminal-green text-terminal-green' : 'fill-terminal-muted/30 text-terminal-muted/30'}`}
                        />
                      </span>
                      <span className="text-sm text-terminal-text truncate">{entry.title}</span>
                      <span className="text-xs px-1.5 py-0.5 border border-terminal-border rounded text-terminal-muted shrink-0">
                        {entry.category}
                      </span>
                      {entry.sourceType && entry.sourceType !== 'manual' && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-400/10 text-blue-400/70 rounded shrink-0">
                          {entry.sourceType}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {entry.tags.map((tag, idx) => (
                        <span key={`${tag}-${idx}`} className="text-xs px-1.5 py-0.5 bg-terminal-green/10 text-terminal-green/70 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-3 text-xs text-terminal-muted/50">
                      <span>updated {timeAgo(entry.updatedAt)}</span>
                      {entry.source && <span>· {entry.source}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openEdit(entry.id)}
                      className="p-2 rounded text-terminal-muted hover:text-terminal-green hover:bg-terminal-green/10 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="p-2 rounded text-terminal-muted hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                      title="Deactivate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-terminal-muted/50 mt-4 text-center">
          <span className="inline-block w-2 h-2 rounded-full bg-terminal-green mr-1 align-middle" /> = embedded for vector search ·
          <span className="inline-block w-2 h-2 rounded-full bg-terminal-muted/30 ml-2 mr-1 align-middle" /> = pending embedding ·
          Deactivated entries are hidden from RAG but not deleted from the database.
        </p>
      </div>
    </div>
  );
}
