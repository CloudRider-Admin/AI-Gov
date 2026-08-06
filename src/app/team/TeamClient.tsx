"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Mail, Copy, Check, Trash2, Building2 } from "lucide-react";
import { INVITE_ROLES, type InviteRole } from "@/lib/governanceEnums";
import { AppPage, PageHeader } from "@/components/app";

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  memberCount: number;
}
interface Member {
  id: string;
  userId: string;
  role: string;
  user: { name: string | null; email: string | null };
}
interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function TeamClient({ canCreateOrg }: { canCreateOrg: boolean }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Create-org form
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("MEMBER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);

  const active = orgs.find((o) => o.id === activeId);
  const canManage = active && ["OWNER", "ADMIN"].includes(active.role);

  const loadOrgs = useCallback(async () => {
    const res = await fetch("/api/organizations");
    const data = await res.json();
    const list: Org[] = data.organizations ?? [];
    setOrgs(list);
    setActiveId((prev) => prev || list[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const loadOrgDetail = useCallback(async (orgId: string, manage: boolean) => {
    const [mRes, iRes] = await Promise.all([
      fetch(`/api/organizations/${orgId}`),
      manage ? fetch(`/api/organizations/${orgId}/invitations`) : Promise.resolve(null),
    ]);
    const mData = await mRes.json().catch(() => ({}));
    setMembers(mData.members ?? []);
    if (iRes) {
      const iData = await iRes.json().catch(() => ({}));
      setInvites(iData.invitations ?? []);
    } else {
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    if (activeId) loadOrgDetail(activeId, Boolean(canManage));
  }, [activeId, canManage, loadOrgDetail]);

  const createOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    setOrgError(null);
    const slug = newOrgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim(), slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create organization");
      }
      setNewOrgName("");
      await loadOrgs();
    } catch (e) {
      setOrgError(e instanceof Error ? e.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const sendInvite = async () => {
    if (!active || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteLink(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/organizations/${active.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteLink(data.invitation.acceptUrl);
        setInviteEmail("");
        loadOrgDetail(active.id, true);
      }
    } finally {
      setInviting(false);
    }
  };

  const revoke = async (inviteId: string) => {
    if (!active) return;
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    await fetch(`/api/organizations/${active.id}/invitations?invitationId=${inviteId}`, {
      method: "DELETE",
    });
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AppPage width="max-w-5xl">
      <PageHeader
        eyebrow="Workspace / Team"
        title="Team & Workspaces"
        description="Invite colleagues to collaborate on your AI governance program with role-based access."
      />

        {loading ? (
          <p className="font-mono text-sm text-terminal-muted">Loading…</p>
        ) : orgs.length === 0 ? (
          <div className="glass rounded-xl p-8 max-w-lg">
            <Building2 className="w-8 h-8 text-terminal-green mb-3" />
            <h2 className="font-mono text-lg text-terminal-text mb-2">Create your workspace</h2>
            {canCreateOrg ? (
              <>
                <p className="text-sm text-terminal-muted mb-4">
                  Set up a shared workspace so your team can co-own the governance program.
                </p>
                {orgError && <p className="text-sm text-terminal-red font-mono mb-3">{orgError}</p>}
                <div className="flex gap-2">
                  <input
                    className="input-field"
                    placeholder="Organization name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                  />
                  <button onClick={createOrg} disabled={creating} className="btn-primary text-sm py-2 whitespace-nowrap">
                    <Plus className="w-4 h-4" /> {creating ? "Creating…" : "Create"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-terminal-muted">
                Shared workspaces are available on the Team and Enterprise plans.{" "}
                <a href="/pricing" className="text-terminal-green hover:underline">
                  View plans →
                </a>
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Workspace switcher */}
            <div className="space-y-2">
              <h2 className="font-mono text-xs uppercase tracking-wider text-terminal-muted px-1 mb-1">
                Workspaces
              </h2>
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setActiveId(o.id)}
                  aria-pressed={o.id === activeId}
                  className={`w-full glass rounded-xl p-3 text-left transition-colors duration-300 ${
                    o.id === activeId ? "border-terminal-green/50" : "hover:border-terminal-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-terminal-text">{o.name}</span>
                    <span className="font-mono text-xs uppercase tracking-wider text-terminal-green">{o.role}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-terminal-muted mt-1">
                    <Users className="w-3 h-3" /> {o.memberCount} · {o.plan}
                  </div>
                </button>
              ))}
            </div>

            {/* Members + invitations */}
            <div className="lg:col-span-2 space-y-4">
              {canManage && (
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-terminal-green" />
                    <h2 className="font-mono text-sm text-terminal-text">Invite a colleague</h2>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="input-field"
                      placeholder="name@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <select
                      className="input-field sm:w-32"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                    >
                      {INVITE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button onClick={sendInvite} disabled={inviting} className="btn-primary text-sm py-2 whitespace-nowrap">
                      {inviting ? "Sending…" : "Send invite"}
                    </button>
                  </div>
                  {inviteLink && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-terminal-border bg-terminal-black/40 px-3 py-2">
                      <span className="font-mono text-xs text-terminal-muted truncate flex-1">{inviteLink}</span>
                      <button onClick={copyLink} className="text-terminal-green hover:text-terminal-text shrink-0" aria-label="Copy link">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Pending invitations */}
              {canManage && invites.length > 0 && (
                <div className="glass rounded-xl p-4">
                  <h2 className="font-mono text-xs uppercase tracking-wider text-terminal-muted mb-3">
                    Pending invitations
                  </h2>
                  <ul className="space-y-2">
                    {invites.map((i) => (
                      <li key={i.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-terminal-text">{i.email}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs uppercase tracking-wider text-terminal-muted">{i.role}</span>
                          <button onClick={() => revoke(i.id)} className="text-terminal-muted hover:text-terminal-red" aria-label="Revoke">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Members */}
              <div className="glass rounded-xl p-4">
                <h2 className="font-mono text-xs uppercase tracking-wider text-terminal-muted mb-3">
                  Members ({members.length})
                </h2>
                <ul className="divide-y divide-terminal-border/50">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="font-mono text-sm text-terminal-text">
                          {m.user.name || m.user.email}
                        </div>
                        {m.user.name && <div className="text-xs text-terminal-muted">{m.user.email}</div>}
                      </div>
                      <span className="font-mono text-xs uppercase tracking-wider text-terminal-green">{m.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
    </AppPage>
  );
}
