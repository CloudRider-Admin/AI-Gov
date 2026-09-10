/**
 * Authentication and session events on the governance audit trail.
 *
 * These were previously not recorded at all: the trail covered register
 * mutations but not who signed in, who failed to, or whose role changed —
 * exactly the events NIST 800-53 AU-2 and AC-7 are about. Kept separate from
 * lib/audit.ts because these calls carry request context (source address, user
 * agent) that the in-app mutations get from their route handlers.
 */

import { writeAuditLog, type AuditOutcome } from './audit';

/** Actor recorded when a sign-in attempt never resolved to a known user. */
const UNKNOWN_ACTOR = 'unauthenticated';

export type AuthAuditAction =
  | 'auth.signed_in'
  | 'auth.signed_out'
  | 'auth.login_failed'
  | 'auth.login_blocked'
  | 'auth.email_unverified'
  | 'auth.role_changed';

/**
 * Headers as NextAuth hands them to `authorize` — a plain object in v4 — or a
 * real `Headers` instance elsewhere. Normalized so callers don't have to care.
 */
type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined;

function header(headers: HeaderBag, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name);
  }
  const value = (headers as Record<string, string | string[] | undefined>)[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

/** Best-effort source attribution for an authentication event. */
export function authRequestContext(headers: HeaderBag): RequestContext {
  const forwarded = header(headers, 'x-forwarded-for');
  return {
    ip: forwarded?.split(',')[0]?.trim() || header(headers, 'x-real-ip') || null,
    userAgent: header(headers, 'user-agent'),
  };
}

/**
 * Append an authentication event. Like every audit write this must never break
 * the flow it observes — `writeAuditLog` already swallows and logs failures, so
 * a sign-in never fails because the trail is unavailable.
 */
/** Which auth events represent a denied or failed attempt rather than a success. */
const NON_SUCCESS: Partial<Record<AuthAuditAction, AuditOutcome>> = {
  'auth.login_failed': 'failure',
  'auth.login_blocked': 'denied',
  'auth.email_unverified': 'denied',
};

export async function recordAuthEvent(params: {
  action: AuthAuditAction;
  /** The resolved user, when the attempt got far enough to identify one. */
  userId?: string | null;
  /** The identifier the attempt was made against. Recorded even when unknown. */
  email?: string | null;
  summary: string;
  context?: RequestContext;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await writeAuditLog({
    actorId: params.userId ?? UNKNOWN_ACTOR,
    action: params.action,
    entityType: 'session',
    entityId: params.userId ?? null,
    summary: params.summary,
    actorIp: params.context?.ip ?? null,
    actorUserAgent: params.context?.userAgent ?? null,
    outcome: NON_SUCCESS[params.action] ?? 'success',
    metadata: {
      email: params.email ?? null,
      ...params.metadata,
    },
  });
}
