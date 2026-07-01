'use client';

import Link from 'next/link';
import { BookOpen, Settings } from 'lucide-react';
import { Advisor } from './Advisor';
import { SovereignConsole } from './sovereign/SovereignConsole';
import { useGoviInterface } from './useGoviInterface';

interface GoviExperienceProps {
  initialQuery?: string;
  initialConversationId?: string;
}

/**
 * Picks the Govi interface skin for the current user.
 *
 * Registered users can opt into the full-bleed "sovereign" audit console from
 * Settings; everyone else (and guests) gets the classic terminal `Advisor` with
 * its page chrome. The sovereign console owns the entire viewport left over
 * after the app header/sidebar, so it renders without the terminal sub-header.
 * The choice resolves from a localStorage cache first for a flicker-free first
 * paint, then reconciles with the server-persisted preference.
 */
export function GoviExperience({ initialQuery, initialConversationId }: GoviExperienceProps) {
  const { preference, isAuthenticated } = useGoviInterface();

  if (isAuthenticated && preference === 'sovereign') {
    return (
      <SovereignConsole
        initialQuery={initialQuery}
        initialConversationId={initialConversationId}
      />
    );
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
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="hidden items-center gap-1.5 rounded border border-terminal-border px-2.5 py-1 font-mono text-xs text-terminal-muted transition-colors hover:border-terminal-green hover:text-terminal-green sm:flex"
            >
              <Settings className="h-3 w-3" />
              Interface
            </Link>
            <Link
              href="/govi/library"
              className="hidden items-center gap-1.5 rounded border border-terminal-border px-2.5 py-1 font-mono text-xs text-terminal-muted transition-colors hover:border-terminal-green hover:text-terminal-green sm:flex"
            >
              <BookOpen className="h-3 w-3" />
              GovSecure Library
            </Link>
          </div>
        </div>
      </div>

      <Advisor
        showHeader={false}
        initialQuery={initialQuery}
        initialConversationId={initialConversationId}
      />
    </div>
  );
}
