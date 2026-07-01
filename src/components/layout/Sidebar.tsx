"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { authedNav } from "./nav";
import { useTheme } from "@/context/ThemeContext";

/**
 * Left-hand dashboard sidebar shown to authenticated users on desktop.
 * Collapses to an icon-only rail; the expanded/collapsed state is owned by
 * AppShell so the main content offset stays in sync.
 * Mobile navigation continues to live in the Header's hamburger menu.
 */
export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { theme, mounted } = useTheme();
  // Show Govi's identity at the top of the sidebar only on the new console UI
  // (the light-theme Govi skin), where the console's own header has been removed.
  const showGoviBrand = mounted && theme === "light" && pathname.startsWith("/govi");

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`hidden md:flex fixed top-16 left-0 bottom-0 z-40 flex-col border-r border-terminal-border bg-terminal-dark transition-[width] duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Govi identity — moved here from the console header (new UI only) */}
      {showGoviBrand && (
        <div
          className={`border-b border-terminal-border ${
            collapsed ? "flex justify-center py-3" : "px-3 pt-3 pb-2.5"
          }`}
        >
          {collapsed ? (
            <span className="h-2 w-2 rounded-full bg-terminal-green" aria-hidden="true" />
          ) : (
            <div className="flex items-start gap-2">
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-terminal-green"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-bold leading-tight text-terminal-green">
                  Govi — AI Governance Advisor
                </p>
                <p className="mt-0.5 font-mono text-[9px] uppercase leading-snug tracking-[0.12em] text-terminal-muted">
                  Anchored by the GovSecure Governance Library
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header row: section label + collapse toggle */}
      <div
        className={`flex items-center h-11 px-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <span className="font-mono text-[10px] tracking-[0.22em] text-terminal-muted uppercase">
            Navigation
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="flex items-center justify-center w-8 h-8 rounded-md text-terminal-muted hover:bg-terminal-gray hover:text-terminal-text transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {authedNav.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.name : undefined}
              className={`flex items-center gap-3 rounded-md py-2.5 font-mono text-sm transition-colors ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                active
                  ? "bg-terminal-green/15 text-terminal-green font-semibold"
                  : "text-terminal-muted hover:bg-terminal-gray hover:text-terminal-text"
              }`}
            >
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                  active ? "bg-terminal-green/20" : ""
                }`}
              >
                {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              {!collapsed && item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
