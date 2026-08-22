"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const STORAGE_KEY = "govsecure:sidebar-collapsed";

/**
 * Renders the authenticated dashboard shell: a collapsible left sidebar plus
 * main content that is offset to make room for it. The collapsed state is owned
 * here (and persisted to localStorage) so the sidebar width and the main
 * content offset always stay in sync. Unauthenticated visitors get the plain
 * full-width layout.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      /* localStorage unavailable — fall back to expanded */
    }
  }, []);

  const toggle = () => {
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

  const offset = isAuthenticated ? (collapsed ? "md:pl-16" : "md:pl-60") : "";

  return (
    <>
      {isAuthenticated && <Sidebar collapsed={collapsed} onToggle={toggle} />}
      <ErrorBoundary>
        <main
          id="main-content"
          tabIndex={-1}
          className={`relative z-10 transition-[padding] duration-300 ${offset}`}
        >
          {children}
        </main>
      </ErrorBoundary>
    </>
  );
}
