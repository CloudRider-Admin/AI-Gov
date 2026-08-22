'use client';

import Link from 'next/link';
import { Terminal, LayoutPanelLeft, Check, ExternalLink } from 'lucide-react';
import { type GoviInterface } from '@/components/advisor/useGoviInterface';
import { useTheme } from '@/context/ThemeContext';
import { AppPage, PageHeader } from '@/components/app';

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
    <div className="mb-2 flex items-center justify-between">
      <span className="tracking-widest text-[#e0e0e0]">
        GOV<span className="text-[#00ff88]">SECURE</span>
      </span>
      <span className="rounded-full bg-[#00ff88]/10 px-1.5 text-[#00ff88]">+3</span>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <div className="rounded border border-[#2a2a2a] bg-[#121212] p-1.5">
        <p className="text-[#888]">AI SYSTEMS</p>
        <p className="text-sm font-bold text-[#e0e0e0]">24</p>
        <div className="mt-1 h-0.5 w-full rounded-full bg-[#1a1a1a]">
          <div className="h-0.5 w-3/4 rounded-full bg-[#00ff88]" />
        </div>
      </div>
      <div className="rounded border border-[#2a2a2a] bg-[#121212] p-1.5">
        <p className="text-[#888]">COVERAGE</p>
        <p className="text-sm font-bold text-[#e0e0e0]">68%</p>
        <div className="mt-1 h-0.5 w-full rounded-full bg-[#1a1a1a]">
          <div className="h-0.5 w-2/3 rounded-full bg-[#00d4ff]" />
        </div>
      </div>
    </div>
  </div>
);

const SovereignPreview = () => (
  <div className="h-full w-full bg-white p-3 font-mono text-[9px] leading-relaxed">
    <div className="mb-2 flex items-center justify-between">
      <span className="tracking-widest text-[#1a1a1a]">
        GOV<span className="text-[#00aa55]">SECURE</span>
      </span>
      <span className="rounded-full bg-[#00aa55]/10 px-1.5 text-[#00aa55]">+3</span>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <div className="rounded border border-[#e0e0e0] bg-[#f8f9fa] p-1.5">
        <p className="text-[#666]">AI SYSTEMS</p>
        <p className="text-sm font-bold text-[#1a1a1a]">24</p>
        <div className="mt-1 h-0.5 w-full rounded-full bg-[#f0f1f3]">
          <div className="h-0.5 w-3/4 rounded-full bg-[#00aa55]" />
        </div>
      </div>
      <div className="rounded border border-[#e0e0e0] bg-[#f8f9fa] p-1.5">
        <p className="text-[#666]">COVERAGE</p>
        <p className="text-sm font-bold text-[#1a1a1a]">68%</p>
        <div className="mt-1 h-0.5 w-full rounded-full bg-[#f0f1f3]">
          <div className="h-0.5 w-2/3 rounded-full bg-[#0099cc]" />
        </div>
      </div>
    </div>
  </div>
);

const OPTIONS: SkinOption[] = [
  {
    id: 'terminal',
    name: 'Dark',
    tagline: 'Default',
    description:
      'The GovSecure terminal aesthetic across the whole app — dark surfaces, neon-green accents, high contrast.',
    bullets: ['High-contrast terminal theme', 'Best for low-light work', 'Matches the Govi console'],
    preview: <TerminalPreview />,
  },
  {
    id: 'sovereign',
    name: 'Light',
    tagline: 'Daylight',
    description:
      'Brighter surfaces for daylight work across dashboards and documents. The Govi console itself stays in its dark command-center style.',
    bullets: [
      'Light app surfaces, softer contrast',
      'Same green accent language',
      'Govi console unchanged',
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
    <AppPage width="max-w-4xl">
      <PageHeader
        eyebrow="Workspace / Settings"
        title="Appearance"
        description="Choose the app's color theme — it applies instantly, and the header toggle does the same thing. The Govi console keeps its dark command-center look on both themes."
      />

        <div className="grid gap-5 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const isActive = active === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => choose(opt.id)}
                className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
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
                    <span className="rounded-full bg-terminal-green/10 px-2 py-0.5 text-xs font-mono uppercase tracking-wide text-terminal-green">
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
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold ${
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

        <div className="flex items-center justify-between rounded-xl border border-terminal-border bg-terminal-dark/40 px-4 py-3">
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
    </AppPage>
  );
}
