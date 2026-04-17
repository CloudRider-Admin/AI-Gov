"use client";

import { useState } from "react";
import Link from "next/link";
import { navigationLevels, trustBadges } from "@/data/content";
import { Mail, ArrowRight, Github, Linkedin, Shield } from "lucide-react";


export function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <footer className="bg-terminal-dark border-t border-terminal-border">
      {/*  Trust badges section */}
      <div className="section py-12 border-b border-terminal-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider">
              Aligned With Industry Standards
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {trustBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-3 px-6 py-3 border border-terminal-border rounded-lg bg-terminal-gray/30 hover:border-terminal-green/50 transition-colors"
              >
                <Shield className="w-5 h-5 text-terminal-green" />
                <div>
                  <div className="font-mono text-sm text-terminal-text">
                    {badge.name}
                  </div>
                  <div className="text-xs text-terminal-muted">
                    {badge.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main footer content */}
      <div className="section py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand column */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 border-2 border-terminal-green rounded flex items-center justify-center">
                  <span className="font-mono text-terminal-green font-bold text-sm">
                    Gov
                  </span>
                </div>
                <span className="font-mono text-lg font-bold text-terminal-text">
                  Secure
                </span>
              </div>
              <p className="text-terminal-muted font-sans text-sm mb-6">
                Helping SMBs adopt and scale AI responsibly, compliantly, and profitably.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="#"
                  className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded-lg hover:border-terminal-green hover:text-terminal-green transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded-lg hover:border-terminal-green hover:text-terminal-green transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded-lg hover:border-terminal-green hover:text-terminal-green transition-colors"
                >
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Learn by Level */}
            <div>
              <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4">
                Learn by Level
              </h4>
              <ul className="space-y-3">
                {navigationLevels.map((level) => (
                  <li key={level.id}>
                    <Link
                      href={level.href}
                      className="text-terminal-muted hover:text-terminal-green font-sans text-sm transition-colors"
                    >
                      {level.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4">
                Resources
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/playbooks"
                    className="text-terminal-muted hover:text-terminal-green font-sans text-sm transition-colors"
                  >
                    Playbooks
                  </Link>
                </li>
                <li>
                  <Link
                    href="/topics"
                    className="text-terminal-muted hover:text-terminal-green font-sans text-sm transition-colors"
                  >
                    Topics
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#templates"
                    className="text-terminal-muted hover:text-terminal-green font-sans text-sm transition-colors"
                  >
                    Templates
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#advisor"
                    className="text-terminal-muted hover:text-terminal-green font-sans text-sm transition-colors"
                  >
                    AI Advisor
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    className="text-terminal-muted hover:text-terminal-green font-sans text-sm transition-colors"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-terminal-muted hover:text-terminal-green font-sans text-sm transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h4 className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4">
                Monthly AI Governance Briefing
              </h4>
              <p className="text-terminal-muted font-sans text-sm mb-4">
                Stay updated on regulations, best practices, and governance strategies.
              </p>
              {status === "success" ? (
                <div className="flex items-center gap-2 text-terminal-green font-mono text-sm">
                  <span>✓</span>
                  <span>Subscribed! Check your inbox.</span>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubscribe} className="flex gap-2">
                    <div className="flex-grow relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        disabled={status === "loading"}
                        className="w-full pl-10 pr-4 py-2 bg-terminal-gray border border-terminal-border rounded font-mono text-sm text-terminal-text placeholder:text-terminal-muted/50 focus:outline-none focus:border-terminal-green disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="px-4 py-2 bg-terminal-green text-terminal-black font-mono text-sm font-semibold rounded hover:bg-terminal-green-dim transition-colors disabled:opacity-50"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                  {status === "error" && (
                    <p className="mt-2 text-red-400 font-mono text-xs">{errorMsg}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-terminal-border py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-terminal-muted font-mono text-xs">
            © {new Date().getFullYear()} CloudRider Nexus. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-terminal-muted hover:text-terminal-green font-mono text-xs transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-terminal-muted hover:text-terminal-green font-mono text-xs transition-colors"
            >
              Terms of Service
            </a>
            <a
              href="#"
              className="text-terminal-muted hover:text-terminal-green font-mono text-xs transition-colors"
            >
              Cookie Settings
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
