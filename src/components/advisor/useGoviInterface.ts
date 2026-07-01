'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export type GoviInterface = 'terminal' | 'sovereign';

const STORAGE_KEY = 'govi_interface';

export function isGoviInterface(value: unknown): value is GoviInterface {
  return value === 'terminal' || value === 'sovereign';
}

function readCached(): GoviInterface | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return isGoviInterface(v) ? v : null;
}

/**
 * Resolves the current user's chosen Govi interface skin.
 *
 * Uses a localStorage cache for an instant, flicker-free first paint, then
 * reconciles with the server (`/api/user/preferences`) so the choice follows
 * the user across devices. `setInterface` writes through to both the cache and
 * the database. Guests always get the classic terminal skin.
 */
export function useGoviInterface() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [preference, setPreference] = useState<GoviInterface>('terminal');
  const [loaded, setLoaded] = useState(false);

  // Instant paint from the local cache before the network resolves.
  useEffect(() => {
    const cached = readCached();
    if (cached) setPreference(cached);
  }, []);

  // Reconcile with the server for authenticated users.
  useEffect(() => {
    if (status === 'loading') return;

    if (!isAuthenticated) {
      setPreference('terminal');
      setLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/preferences');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && isGoviInterface(data.goviInterface)) {
            setPreference(data.goviInterface);
            window.localStorage.setItem(STORAGE_KEY, data.goviInterface);
          }
        }
      } catch {
        // Non-fatal — keep the cached/default preference.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, isAuthenticated]);

  const setInterface = async (next: GoviInterface) => {
    setPreference(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    if (!isAuthenticated) return;
    try {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goviInterface: next }),
      });
    } catch {
      // Non-fatal — the local cache still reflects the choice.
    }
  };

  return { preference, setInterface, loaded, isAuthenticated };
}
