'use client';

import Link from 'next/link';
import { Terminal, LayoutPanelLeft, Check, ExternalLink } from 'lucide-react';
import { type GoviInterface } from '@/components/advisor/useGoviInterface';
import { useTheme } from '@/context/ThemeContext';

interface SettingsClientProps {
  initialInterface: GoviInterface;
}

interface SkinOption {
  id: GoviInterface;
  name: string;
  tagline: string;
  description: string;
  bullets: string[];
  preview: React.ReactNode;
}

const TerminalPreview = () => (
  <div className="h-full w-full bg-[#0a0a0a] p-3 font-mono text-[9px] leading-relaxed">
    <div className="mb-2 flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      <span className="ml-2 text-[#888]">Govi v1.0</span>
    </div>
    <p className="text-[#00ff88]">{'>'} analyze data retention policy_</p>
    <div className="mt-2 rounded border border-[#2a2a2a] p-1.5">
      <p className="text-[#e0e0e0]">RISK: <span className="text-[#ffb800]">MEDIUM</span></p>
      <p className="text-[#888]">EU AI Act · Article 12</p>
    </div>
  </div>
);

const SovereignPreview = () => (
  <div className="flex h-full w-full bg-white text-[9px]">
    <div className="flex-1 p-3">
      <p className="font-semibold text-slate-800">AI Governance Advisor</p>
      <div className="mt-2 ml-auto w-2/3 rounded-lg rounded-tr-sm bg-slate-100 p-1.5 text-slate-600">
        Analyze retention policy…
      </div>
      <div className="mt-2 rounded-lg border border-slate-200 p-1.5">
        <span className="font-semibold text-emerald-600">G</span>{' '}
        <span className="text-slate-500">Govi</span>
        <div className="mt-1 h-1 w-3/4 rounded-full bg-slate-100" />
      </div>
    </div>
    <div className="w-1/3 border-l border-slate-100 p-2">
      <p className="text-[7px] font-semibold uppercase text-slate-400">Readiness</p>
      <div className="mt-1 h-1 w-full rounded-full bg-slate-200">
        <div className="h-1 w-4/5 rounded-full bg-emerald-500" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded border border-slate-200 px-1 text-slate-600">EU AI Act</span>
      </div>
    </div>
  </div>
);

const OPTIONS: SkinOption[] = [
  {
    id: 'terminal',
    name: 'Classic Terminal',
    tagline: 'Dark theme',
    description:
      'The original Govi — a focused, retro terminal advisor with the GovSecure aesthetic. Pairs with the dark theme.',
    bullets: ['High-contrast terminal theme', 'Single-column, distraction-free', 'Familiar Govi v1 layout'],
    preview: <TerminalPreview />,
  },
  {
    id: 'sovereign',
    name: 'Console',
    tagline: 'Light theme',
    description:
      'A modern, full-width workspace with a live governance analysis panel: compliance readiness, risk exposure, detected regulatory entities and cited sources. Pairs with the light theme.',
    bullets: [
      'Live governance analysis side panel',
      'Readiness & risk-exposure gauges',
      'Detected entities + reference documents',
      'Exportable session log',
    ],
    preview: <SovereignPreview />,
  },
];

export function SettingsClient({ initialInterface }: SettingsClientProps) {
  const { theme, setTheme, mounted } = useTheme();

  // The Govi skin is driven by the app theme: dark → terminal, light → console
  // (the header's light/dark toggle does the same thing). Until the theme
  // resolves on the client we fall back to the server-rendered preference.
  const active: GoviInterface = mounted
    ? theme === 'light'
      ? 'sovereign'
      : 'terminal'
    : initialInterface;

  const choose = (id: GoviInterface) => {
    setTheme(id === 'sovereign' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-terminal-green">
          Settings
        </div>
        <h1 className="text-2xl font-bold text-terminal-text">Govi Interface</h1>
        <p className="mt-2 max-w-2xl text-sm text-terminal-muted">
          Choose how the Govi advisor looks and feels. This is tied to your
          light/dark theme — picking one here switches the app theme too, and
          applies instantly. You can also use the theme toggle in the header.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const isActive = active === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => choose(opt.id)}
                className={`group relative overflow-hidden rounded-2xl border text-left transition-all ${
                  isActive
                    ? 'border-terminal-green ring-2 ring-terminal-green/30'
                    : 'border-terminal-border hover:border-terminal-green/50'
                }`}
              >
                {/* Preview window */}
                <div className="relative h-36 overflow-hidden border-b border-terminal-border">
                  {opt.preview}
                  {isActive && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-terminal-green text-black shadow">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    {opt.id === 'terminal' ? (
                      <Terminal className="h-4 w-4 text-terminal-green" />
                    ) : (
                      <LayoutPanelLeft className="h-4 w-4 text-terminal-green" />
                    )}
                    <span className="font-mono text-sm font-bold text-terminal-text">
                      {opt.name}
                    </span>
                    <span className="rounded-full bg-terminal-green/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-terminal-green">
                      {opt.tagline}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-terminal-muted">{opt.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {opt.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-terminal-text">
                        <Check className="h-3 w-3 shrink-0 text-terminal-green" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold ${
                        isActive
                          ? 'bg-terminal-green/15 text-terminal-green'
                          : 'border border-terminal-border text-terminal-muted group-hover:text-terminal-text'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Check className="h-3 w-3" /> Active
                        </>
                      ) : (
                        'Use this style'
                      )}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-terminal-border bg-terminal-bg-secondary/40 px-4 py-3">
          <p className="text-xs text-terminal-muted">
            Applies instantly across Govi.
          </p>
          <Link
            href="/govi"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-terminal-green hover:underline"
          >
            Open Govi <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
