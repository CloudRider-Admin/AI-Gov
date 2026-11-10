"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  ChevronsUpDown,
  Settings,
  Shield,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { SearchTrigger } from "@/components/search";
import { useTheme } from "@/context/ThemeContext";
import { authedNavGroups, isNavActive } from "./nav";

/**
 * Full-height app sidebar for signed-in users on desktop (Claude-style):
 * brand + collapse toggle, "New chat" and Search, grouped navigation, and the
 * account menu (settings, theme, admin, sign out) pinned to the bottom.
 * Collapses to a 60px icon rail; the state is owned by AppShell so the content
 * offset stays in sync. Mobile navigation lives in the Header's menu.
 */
export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Collapsed-rail label tooltip, rendered once at fixed position because the
  // scrolling <nav> clips anything overflowing its right edge.
  const [hoveredLabel, setHoveredLabel] = useState<{ name: string; top: number } | null>(null);
  const showLabel = (name: string) => (e: { currentTarget: HTMLElement }) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredLabel({ name, top: rect.top + rect.height / 2 });
  };
  const hideLabel = () => setHoveredLabel(null);

  const startNewChat = () => router.push(`/govi?new=${Date.now()}`);

  const rowBase = `flex h-9 items-center gap-3 rounded-lg text-sm transition-colors ${
    collapsed ? "justify-center px-0" : "px-2.5"
  }`;

  return (
    <aside
      className={`fixed bottom-0 left-0 top-[var(--header-h)] z-40 hidden flex-col border-r border-terminal-border bg-[var(--app-sidebar)] transition-[width] duration-300 md:flex ${
        collapsed ? "w-[60px]" : "w-64"
      }`}
    >
      {/* Brand + collapse toggle */}
      <div className={`flex h-14 flex-none items-center ${collapsed ? "justify-center" : "justify-between pl-4 pr-2"}`}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2" aria-label="GovSecure home">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight text-terminal-text">GovSecure</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="grid h-8 w-8 place-items-center rounded-lg text-terminal-muted transition-colors hover:bg-terminal-text/[0.06] hover:text-terminal-text"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Primary actions */}
      <div className="flex-none space-y-0.5 px-2.5 pb-2">
        <button
          type="button"
          onClick={startNewChat}
          onMouseEnter={showLabel("New Govi chat")}
          onMouseLeave={hideLabel}
          onFocus={showLabel("New Govi chat")}
          onBlur={hideLabel}
          aria-label="New Govi chat"
          className={`${rowBase} w-full font-medium text-terminal-text hover:bg-terminal-text/[0.06]`}
        >
          <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-terminal-green text-[var(--color-bg-secondary)]">
            <SquarePen className="h-3 w-3" aria-hidden="true" />
          </span>
          {!collapsed && "New Govi chat"}
        </button>
        <SearchTrigger variant="sidebar" collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Main">
        {authedNavGroups.map((group, gi) => (
          <div key={group.label} className={gi === 0 ? "" : "mt-4"}>
            {collapsed ? (
              gi > 0 && <div className="mx-2 mb-2 border-t border-terminal-border" aria-hidden="true" />
            ) : (
              <p className="mb-1 px-2.5 text-xs font-medium text-terminal-muted">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? item.name : undefined}
                      onMouseEnter={showLabel(item.name)}
                      onMouseLeave={hideLabel}
                      onFocus={showLabel(item.name)}
                      onBlur={hideLabel}
                      className={`${rowBase} ${
                        active
                          ? "bg-terminal-text/[0.08] font-medium text-terminal-text"
                          : "text-terminal-muted hover:bg-terminal-text/[0.05] hover:text-terminal-text"
                      }`}
                    >
                      {Icon && (
                        <Icon
                          className={`h-4 w-4 flex-none ${active ? "text-terminal-green" : ""}`}
                          aria-hidden="true"
                        />
                      )}
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="flex-none border-t border-terminal-border p-2.5">
        <AccountMenu collapsed={collapsed} />
      </div>

      {collapsed && hoveredLabel && (
        <span
          role="tooltip"
          style={{ top: hoveredLabel.top }}
          className="shadow-app pointer-events-none fixed left-[60px] z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-terminal-border bg-terminal-dark px-2 py-1 text-xs text-terminal-text"
        >
          {hoveredLabel.name}
        </span>
      )}
    </aside>
  );
}

/** The GovSecure mark — a rounded green tile with the "G" monogram. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-lg bg-terminal-green font-semibold text-[var(--color-bg-secondary)]"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      G
    </span>
  );
}

function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const { data: session } = useSession();
  const { theme, toggleTheme, mounted } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  const user = session?.user as { name?: string | null; email?: string | null; role?: string } | undefined;
  const name = user?.name || user?.email || "Account";
  const initial = name.trim().charAt(0).toUpperCase();
  const plan = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : null;

  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-terminal-text transition-colors hover:bg-terminal-text/[0.06]";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex w-full items-center gap-2.5 rounded-lg py-1.5 transition-colors hover:bg-terminal-text/[0.06] ${
          collapsed ? "justify-center px-0" : "px-2"
        } ${open ? "bg-terminal-text/[0.06]" : ""}`}
      >
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-terminal-text text-xs font-semibold text-[var(--color-bg-secondary)]">
          {initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium text-terminal-text">{name}</span>
              {plan && <span className="block text-xs text-terminal-muted">{plan} plan</span>}
            </span>
            <ChevronsUpDown className="h-4 w-4 flex-none text-terminal-muted" aria-hidden="true" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`shadow-app absolute bottom-full z-50 mb-2 w-60 rounded-xl border border-terminal-border bg-terminal-dark p-1.5 ${
            collapsed ? "left-0" : "left-0 right-0 w-auto"
          }`}
        >
          {user?.email && (
            <p className="truncate px-2.5 pb-2 pt-1.5 text-xs text-terminal-muted">{user.email}</p>
          )}
          <Link href="/settings" role="menuitem" className={item}>
            <Settings className="h-4 w-4 text-terminal-muted" aria-hidden="true" />
            Settings
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" role="menuitem" className={item}>
              <Shield className="h-4 w-4 text-terminal-muted" aria-hidden="true" />
              Admin
            </Link>
          )}
          <button type="button" role="menuitem" onClick={toggleTheme} disabled={!mounted} className={item}>
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-terminal-muted" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-terminal-muted" aria-hidden="true" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="my-1 border-t border-terminal-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={item}
          >
            <LogOut className="h-4 w-4 text-terminal-muted" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
