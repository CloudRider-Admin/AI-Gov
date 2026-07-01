"use client";

import { useState } from "react";
import Link from "next/link";
import { trustBadges } from "@/data/content";
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
    <footer className="relative rounded-t-[2.5rem] border-t border-terminal-border bg-terminal-dark">
      {/* Moving highlight that travels along the curved top border */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-[2.5rem]"
      >
        <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-terminal-green to-transparent animate-shimmer motion-reduce:hidden" />
      </div>

      {/* ── Industry-standards CTA — a standout, motion-bordered card ── */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 -mt-14 md:-mt-16">
        <div className="group relative overflow-hidden rounded-[2rem] p-[1.5px]">
          {/* Rotating conic-gradient ring = the curved border in motion */}
          <span
            aria-hidden="true"
            className="absolute inset-[-120%] animate-spin [animation-duration:9s] motion-reduce:hidden"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgb(var(--color-accent-rgb)) 55deg, transparent 130deg, transparent 230deg, rgb(var(--color-cyan-rgb)) 305deg, transparent 360deg)",
            }}
          />
          {/* Static border fallback (visible under the ring / for reduced motion) */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[2rem] border border-terminal-border"
          />

          {/* Card body */}
          <div className="relative overflow-hidden rounded-[calc(2rem-1.5px)] bg-terminal-dark px-6 py-10 text-center shadow-[0_0_60px_-20px_rgba(0,255,136,0.35)] sm:px-12">
            {/* Ambient glow wash */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(0,255,136,0.10), transparent 60%)",
              }}
            />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-terminal-green/30 bg-terminal-green/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-terminal-green animate-glow motion-reduce:animate-none">
                <Shield className="h-3.5 w-3.5" />
                Aligned With Industry Standards
              </span>
              <h3 className="mx-auto mt-5 max-w-2xl font-mono text-2xl font-bold leading-tight text-terminal-text sm:text-3xl">
                Compliance mapped to the frameworks that matter
              </h3>
              <p className="mx-auto mt-3 max-w-xl font-sans text-sm leading-relaxed text-terminal-muted">
                Every assessment, policy, and playbook GovSecure generates is aligned to the
                standards regulators and auditors expect.
              </p>

              {/* Standards as interactive pills */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                {trustBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-2 rounded-full border border-terminal-border bg-terminal-black/40 px-3.5 py-1.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-terminal-green/60 hover:shadow-[0_0_18px_-6px_rgba(0,255,136,0.5)]"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0 text-terminal-green" />
                    <span className="font-mono text-xs text-terminal-text">{badge.name}</span>
                    <span className="hidden font-sans text-[11px] text-terminal-muted sm:inline">
                      · {badge.description}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/assessment"
                className="group/btn mt-8 inline-flex items-center gap-2 rounded-full bg-terminal-green px-6 py-3 font-mono text-sm font-semibold text-terminal-black transition-all duration-300 hover:gap-3 hover:bg-terminal-green-dim"
              >
                Start your free assessment
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer content */}
      <div className="section pt-14 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand column */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 border-2 border-terminal-green rounded-md flex items-center justify-center">
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
                  className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded-md hover:border-terminal-green hover:text-terminal-green transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded-md hover:border-terminal-green hover:text-terminal-green transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded-md hover:border-terminal-green hover:text-terminal-green transition-colors"
                >
                  <Github className="w-4 h-4" />
                </a>
              </div>
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
                        className="w-full pl-10 pr-4 py-2 bg-terminal-gray border border-terminal-border rounded-md font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:border-terminal-green disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="px-4 py-2 bg-terminal-green text-terminal-black font-mono text-sm font-semibold rounded-md hover:bg-terminal-green-dim transition-colors disabled:opacity-50"
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
