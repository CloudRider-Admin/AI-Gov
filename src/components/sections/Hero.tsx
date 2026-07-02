"use client";

import Link from "next/link";
import { heroContent } from "@/data/content";
import { ArrowRight, BookOpen } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center section">
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center">
          {/* Terminal-style prefix */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 border border-terminal-border rounded-full bg-terminal-dark/50">
            <span className="w-2 h-2 bg-terminal-green rounded-full animate-pulse" />
            <span className="font-mono text-sm text-terminal-muted">
              AI Governance Platform for SMBs
            </span>
          </div>

          {/* Main headline with cursor blink */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-mono font-bold text-terminal-text mb-6 leading-tight">
            <span className="cursor-blink">{heroContent.headline}</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-terminal-muted font-sans max-w-3xl mx-auto mb-8 leading-relaxed">
            {heroContent.subheadline}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link href="/signup" className="btn-primary group">
              {heroContent.primaryCta}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/playbooks" className="btn-secondary group">
              <BookOpen className="w-4 h-4" />
              {heroContent.secondaryCta}
            </Link>
          </div>

          {/* Support text */}
          <p className="text-sm text-terminal-muted font-sans max-w-2xl mx-auto border-t border-terminal-border pt-8">
            {heroContent.supportText}
          </p>
        </div>

        {/* Terminal decoration - full width below grid */}
        {/*<div className="mt-16 terminal-window max-w-2xl mx-auto text-left animate-fade-in">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500" />
            <div className="terminal-dot bg-yellow-500" />
            <div className="terminal-dot bg-green-500" />
            <span className="ml-4 text-xs text-terminal-muted font-mono">
              govi-cli
            </span>
          </div>
          <div className="terminal-body">
            <div className="text-terminal-green">
              $ govsecure init --framework smb
            </div>
            <div className="text-terminal-muted mt-2">
              ✓ Initializing governance framework...
            </div>
            <div className="text-terminal-muted">
              ✓ Loading compliance templates...
            </div>
            <div className="text-terminal-muted">
              ✓ Configuring risk assessment modules...
            </div>
            <div className="text-terminal-green mt-2">
              Ready. Your AI governance journey begins now.
            </div>
          </div>
        </div>*/}
      </div>
    </section>
  );
}
