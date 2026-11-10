'use client';

import { SovereignConsole } from './sovereign/SovereignConsole';
import { useGoviSession } from './useGoviSession';

interface GoviExperienceProps {
  initialQuery?: string;
  initialConversationId?: string;
}

/**
 * Owns the shared Govi session and renders the console.
 *
 * The console is the single /govi experience: Govi's chat list, the centered
 * conversation, and the side-by-side document pane. It follows the app's
 * light/dark theme. The classic terminal `AdvisorView` remains in the
 * codebase but is no longer routed to.
 */
export function GoviExperience({ initialQuery, initialConversationId }: GoviExperienceProps) {
  const govi = useGoviSession({ initialQuery, initialConversationId });
  return <SovereignConsole session={govi} />;
}
