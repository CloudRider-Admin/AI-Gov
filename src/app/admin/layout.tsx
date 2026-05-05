'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  ChevronLeft,
} from 'lucide-react';

type SystemStatus = 'operational' | 'degraded' | 'down';

const coreNav = [
  { name: 'Admin Panel', href: '/admin', icon: LayoutDashboard, match: 'exact' as const },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3, match: 'startsWith' as const },
  { name: 'Knowledge Base', href: '/admin/knowledge', icon: BookOpen, match: 'startsWith' as const },
];

const STATUS_BADGE: Record<SystemStatus, { label: string; className: string }> = {
  operational: { label: 'Operational', className: 'text-terminal-green' },
  degraded:    { label: 'Degraded',    className: 'text-terminal-amber' },
  down:        { label: 'Down',        className: 'text-terminal-red' },
};

const VERSION = 'V2.4.0-STABLE';
const STATUS_POLL_MS = 60_000;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<SystemStatus | 'unknown'>('unknown');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/overview', { cache: 'no-store' });
        if (!res.ok) throw new Error('unauthorized or error');
        const data = await res.json();
        if (!cancelled && data?.systemStatus) setStatus(data.systemStatus);
      } catch {
        if (!cancelled) setStatus('down');
      }
    };
    load();
    const id = setInterval(load, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const isActive = (href: string, match: 'exact' | 'startsWith') =>
    match === 'exact' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const badge = status === 'unknown' ? { label: '…', className: 'text-terminal-muted' } : STATUS_BADGE[status];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-terminal-dark text-terminal-text">
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 border-r border-terminal-border bg-terminal-dark hidden md:flex flex-col">
          <div className="sticky top-16 flex flex-col h-[calc(100vh-4rem)]">
            <nav className="flex-1 overflow-y-auto p-5 space-y-8">
              {/* Core Management group */}
              <div>
                <div className="px-3 mb-3 font-mono text-[10px] tracking-[0.22em] text-terminal-muted uppercase">
                  Core Management
                </div>
                <div className="space-y-1">
                  {coreNav.map((item) => {
                    const active = isActive(item.href, item.match);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-mono text-sm transition-colors ${
                          active
                            ? 'bg-terminal-green/15 text-terminal-green font-semibold'
                            : 'text-terminal-muted hover:bg-terminal-gray hover:text-terminal-text'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span
                          className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                            active ? 'bg-terminal-green/20' : ''
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Back-to-app link */}
              <div className="pt-2 border-t border-terminal-border">
                <Link
                  href="/govi"
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 font-mono text-sm text-terminal-muted hover:bg-terminal-gray hover:text-terminal-text transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to App
                </Link>
              </div>
            </nav>

            {/* Node status badge — live-polled from /api/admin/overview. */}
            <div className="p-4">
              <div className="rounded-xl border border-terminal-border bg-terminal-black px-4 py-3">
                <div className="font-mono text-xs text-terminal-green">{VERSION}</div>
                <div className="font-mono text-[11px] mt-1 flex items-center gap-1.5 text-terminal-muted">
                  Node status:
                  <span className={`inline-flex items-center gap-1 ${badge.className}`}>
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        status === 'operational'
                          ? 'bg-terminal-green animate-pulse'
                          : status === 'degraded'
                          ? 'bg-terminal-amber'
                          : status === 'down'
                          ? 'bg-terminal-red'
                          : 'bg-terminal-muted'
                      }`}
                    />
                    {badge.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Mobile bottom nav ─────────────────────────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-terminal-border bg-terminal-dark/95 backdrop-blur-sm">
          <div className="flex items-center justify-around py-2">
            {coreNav.map((item) => {
              const active = isActive(item.href, item.match);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-1 font-mono text-[11px] transition-colors ${
                    active ? 'text-terminal-green' : 'text-terminal-muted'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Main content ──────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 pb-20 md:pb-0 bg-terminal-dark">
          {children}
        </main>
      </div>
    </div>
  );
}