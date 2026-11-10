"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const STORAGE_KEY = "govsecure:sidebar-collapsed";
/** Set while signed in; lets the layout render before the session resolves. */
const AUTH_HINT_KEY = "govsecure:authed";

/** The Govi chat itself (not its /govi/library or /govi/regulations content pages). */
export function isGoviChatRoute(pathname: string): boolean {
  return pathname === "/govi";
}

/**
 * Renders the authenticated app shell: a full-height left sidebar plus main
 * content offset to make room for it. Signed-in users also get the `app-ui`
 * class on <html>, which switches every terminal-* token to the app palette
 * and hides the desktop top header (see globals.css).
 *
 * The collapsed state is owned here (and persisted to localStorage) so the
 * sidebar width and the content offset always stay in sync. On the Govi chat
 * the sidebar drops to its icon rail so the conversation gets the room —
 * without overwriting the user's saved preference.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  // Returning signed-in users get the app shell immediately (from a local
  // hint) instead of flashing the public layout while the session loads.
  const [authHint, setAuthHint] = useState(false);
  const isAuthenticated = status === "authenticated" || (status === "loading" && authHint);
  const [collapsed, setCollapsed] = useState(false);
  // On the Govi chat the rail is the default; this lets the user peek it open.
  const [goviExpanded, setGoviExpanded] = useState(false);
  const onGoviChat = isGoviChatRoute(pathname);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
      setAuthHint(localStorage.getItem(AUTH_HINT_KEY) === "1");
    } catch {
      /* localStorage unavailable — fall back to expanded */
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    try {
      if (status === "authenticated") localStorage.setItem(AUTH_HINT_KEY, "1");
      else localStorage.removeItem(AUTH_HINT_KEY);
    } catch {
      /* ignore */
    }
  }, [status]);

  useEffect(() => {
    setGoviExpanded(false);
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (isAuthenticated) root.classList.add("app-ui");
    // While loading, keep whatever the preload script decided.
    else if (status !== "loading") root.classList.remove("app-ui");
  }, [isAuthenticated, status]);

  const effectiveCollapsed = onGoviChat ? !goviExpanded : collapsed;

  const toggle = () => {
    if (onGoviChat) {
      setGoviExpanded((v) => !v);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore persistence failure */
      }
      return next;
    });
  };

  const offset = isAuthenticated ? (effectiveCollapsed ? "md:pl-[60px]" : "md:pl-64") : "";

  return (
    <>
      {isAuthenticated && <Sidebar collapsed={effectiveCollapsed} onToggle={toggle} />}
      <ErrorBoundary>
        <main className={`relative z-10 transition-[padding] duration-300 ${offset}`}>
          {children}
        </main>
      </ErrorBoundary>
    </>
  );
}
