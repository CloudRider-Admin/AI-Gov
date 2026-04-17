import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

/**
 * Returns the current session or null. Does NOT enforce authentication.
 */
export async function getOptionalSession() {
  const session = await getServerSession(authOptions);
  return session ?? null;
}

/**
 * Requires authentication. Redirects to /signin if no session exists.
 * Use in Server Components and Route Handlers that must be protected.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/signin');
  }
  return session;
}
