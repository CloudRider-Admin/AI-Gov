"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, ChevronDown, LogOut, User, Shield } from "lucide-react";
import { SearchTrigger } from "@/components/search";
import { ThemeToggle } from "@/components/ui";

type NavItem = {
  name: string;
  href: string;
  children?: { name: string; href: string }[];
};

const publicNav: NavItem[] = [
  { name: "Home", href: "/" },
  { name: "Govi Advisor", href: "/govi" },
  {
    name: "Learn",
    href: "/learn",
    children: [
      { name: "Getting Started", href: "/learn/getting-started" },
      { name: "Scaling", href: "/learn/scaling" },
      { name: "Advanced", href: "/learn/advanced" },
    ],
  },
  { name: "Pricing", href: "/pricing" },
  { name: "FAQ", href: "/faq" },
  { name: "Contact", href: "/contact" },
];

const authedNav: NavItem[] = [
  { name: "Home", href: "/" },
  { name: "Playbooks", href: "/playbooks" },
  { name: "Topics", href: "/topics" },
  { name: "Govi", href: "/govi" },
  {
    name: "Learn",
    href: "/learn",
    children: [
      { name: "Getting Started", href: "/learn/getting-started" },
      { name: "Scaling", href: "/learn/scaling" },
      { name: "Advanced", href: "/learn/advanced" },
    ],
  },
  { name: "FAQ", href: "/faq" },
  { name: "Contact", href: "/contact" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAuthenticated = status === "authenticated";
  const navigation = isAuthenticated ? authedNav : publicNav;

  // Close user menu on outside-click / Escape
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-terminal-black/90 backdrop-blur-sm border-b border-terminal-border">
      <nav className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1">
            <div className="w-10 h-8 border-2 border-terminal-green rounded-md flex items-center justify-center">
              <span className="font-mono text-terminal-green font-bold text-sm">Gov</span>
            </div>
            <span className="font-mono text-lg font-bold text-terminal-text">
              Secure
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <div key={item.name} className="relative">
                {item.children ? (
                  <div
                    className="relative"
                    onMouseEnter={() => setOpenDropdown(item.name)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <button
                      className={`flex items-center gap-1 px-4 py-2 font-mono text-sm transition-colors ${isActive(item.href)
                          ? "text-terminal-green"
                          : "text-terminal-muted hover:text-terminal-text"
                        }`}
                    >
                      {item.name}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {openDropdown === item.name && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-terminal-dark border border-terminal-border rounded-xl shadow-xl py-2">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={`block px-4 py-2 font-mono text-sm transition-colors ${isActive(child.href)
                                ? "text-terminal-green bg-terminal-green/10"
                                : "text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray"
                              }`}
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={`px-4 py-2 font-mono text-sm transition-colors ${isActive(item.href)
                        ? "text-terminal-green"
                        : "text-terminal-muted hover:text-terminal-text"
                      }`}
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Auth area */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && <SearchTrigger />}
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                    userMenuOpen
                      ? 'bg-terminal-green/15 text-terminal-green'
                      : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray/50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="max-w-[140px] truncate">
                    {session.user?.name ?? session.user?.email}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 w-52 bg-terminal-dark border border-terminal-border rounded-xl shadow-xl py-1 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-terminal-border">
                      <p className="text-xs font-mono text-terminal-muted truncate">
                        {session.user?.email}
                      </p>
                    </div>
                    {(session.user as { role?: string })?.role === 'ADMIN' && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 font-mono text-sm transition-colors ${
                          pathname.startsWith('/admin')
                            ? 'text-terminal-green bg-terminal-green/10'
                            : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray'
                        }`}
                      >
                        <Shield className="w-4 h-4" aria-hidden="true" />
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 font-mono text-sm text-terminal-muted hover:text-terminal-text hover:bg-terminal-gray transition-colors"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/signup" className="btn-primary text-sm py-2">
                Get Started
              </Link>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden flex items-center gap-1">
            {isAuthenticated && <SearchTrigger showShortcut={false} />}
            <ThemeToggle />
            <button
              className="p-2 text-terminal-muted hover:text-terminal-text"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-terminal-border">
            {navigation.map((item) => (
              <div key={item.name}>
                <Link
                  href={item.href}
                  className={`block px-4 py-3 font-mono text-sm transition-colors ${isActive(item.href)
                      ? "text-terminal-green"
                      : "text-terminal-muted hover:text-terminal-text"
                    }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
                {item.children && (
                  <div className="pl-4">
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={`block px-4 py-2 font-mono text-xs transition-colors ${isActive(child.href)
                            ? "text-terminal-green"
                            : "text-terminal-muted hover:text-terminal-text"
                          }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        → {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="px-4 pt-4 space-y-2">
              {isAuthenticated ? (
                <>
                  {(session.user as { role?: string })?.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 font-mono text-sm text-terminal-green border border-terminal-green/30 rounded-md transition-colors hover:bg-terminal-green/10"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Shield className="w-4 h-4" />
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { signOut({ callbackUrl: '/' }); setMobileMenuOpen(false); }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 font-mono text-sm text-terminal-muted hover:text-terminal-text border border-terminal-border rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/signup"
                  className="btn-primary text-sm py-2 w-full text-center block"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
