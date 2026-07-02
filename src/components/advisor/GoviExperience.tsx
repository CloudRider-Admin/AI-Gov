'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { AdvisorView } from './Advisor';
import { SovereignConsole } from './sovereign/SovereignConsole';
import { useGoviSession } from './useGoviSession';
import { useTheme } from '@/context/ThemeContext';

interface GoviExperienceProps {
  initialQuery?: string;
  initialConversationId?: string;
}

/**
 * Picks the Govi interface skin and owns the shared session.
 *
 * The app's dark/light theme toggle drives the skin: the dark theme shows the
 * classic terminal `Advisor`; the light theme shows the full-bleed console — so
 * each skin's colours always match the current theme. The session (thread,
 * active conversation, streaming state) lives here, above both skins, so
 * flipping the theme swaps the skin without losing the conversation. Until the
 * theme resolves on the client we render the terminal skin to match SSR.
 */
export function GoviExperience({ initialQuery, initialConversationId }: GoviExperienceProps) {
  const govi = useGoviSession({ initialQuery, initialConversationId });
  const { theme, mounted } = useTheme();

  if (mounted && theme === 'light') {
    return <SovereignConsole session={govi} />;
  }

  return (
    <div className="min-h-screen pt-16 pb-12">
      <div className="sticky top-16 z-10 border-b border-terminal-border bg-terminal-black/80 px-6 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-sm font-bold text-terminal-green">
              Govi — AI Governance Advisor
            </h1>
            <p className="mt-0.5 font-mono text-xs text-terminal-muted">
              Anchored by the GovSecure Governance Library
            </p>
          </div>
          <Link
            href="/govi/library"
            className="hidden items-center gap-1.5 rounded border border-terminal-border px-2.5 py-1 font-mono text-xs text-terminal-muted transition-colors hover:border-terminal-green hover:text-terminal-green sm:flex"
          >
            <BookOpen className="h-3 w-3" />
            GovSecure Library
          </Link>
        </div>
      </div>

      <AdvisorView session={govi} showHeader={false} />
    </div>
  );
}
