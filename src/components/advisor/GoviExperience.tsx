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
 * The Sovereign console is the single /govi experience for all users on both
 * app themes — it pins its own dark terminal palette via `.sovereign-scope`
 * (see globals.css), so it matches the AAA console design everywhere. The
 * classic terminal `AdvisorView` remains in the codebase but is no longer
 * routed to.
 */
export function GoviExperience({ initialQuery, initialConversationId }: GoviExperienceProps) {
  const govi = useGoviSession({ initialQuery, initialConversationId });
  return <SovereignConsole session={govi} />;
}
