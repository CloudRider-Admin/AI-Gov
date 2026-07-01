'use client';

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
 * Registered users can opt into the "sovereign" audit console from Settings;
 * everyone else (and guests) gets the classic terminal `Advisor`. The choice
 * resolves from a localStorage cache first for a flicker-free first paint, then
 * reconciles with the server-persisted preference.
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
    <Advisor
      showHeader={false}
      initialQuery={initialQuery}
      initialConversationId={initialConversationId}
    />
  );
}
