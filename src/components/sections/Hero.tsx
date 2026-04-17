"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { heroContent } from "@/data/content";
import { ArrowRight, BookOpen } from "lucide-react";

const InteractiveGlobe = dynamic(
  () => import("@/components/three/InteractiveGlobe").then((mod) => mod.InteractiveGlobe),
  { ssr: false, loading: () => <div className="w-full h-full min-h-[400px] flex items-center justify-center"><span className="text-terminal-muted font-mono text-sm">Loading navigation globe...</span></div> }
);

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center section">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-32 h-32 border border-terminal-border rounded-full opacity-20" />
      <div className="absolute bottom-20 right-10 w-48 h-48 border border-terminal-green/20 rounded-full opacity-30" />

      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
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
            <p className="text-lg md:text-xl text-terminal-muted font-sans max-w-3xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              {heroContent.subheadline}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 mb-10">
              <Link href="/learn/getting-started" className="btn-primary group">
                {heroContent.primaryCta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/playbooks" className="btn-secondary group">
                <BookOpen className="w-4 h-4" />
                {heroContent.secondaryCta}
              </Link>
            </div>

            {/* Support text */}
            <p className="text-sm text-terminal-muted font-sans max-w-2xl mx-auto lg:mx-0 border-t border-terminal-border pt-8">
              {heroContent.supportText}
            </p>
          </div>

          {/* Interactive 3D Navigation Globe */}
          <div className="relative w-full max-w-2xl mx-auto">
            <div className="relative h-[500px] rounded-2xl overflow-hidden">
              <InteractiveGlobe />
            </div>

            {/* Globe legend */}
            <div className="mt-6 space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00ff88]"></span>
                  <span className="text-terminal-muted">Learn</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00d4ff]"></span>
                  <span className="text-terminal-muted">Playbooks</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ffb800]"></span>
                  <span className="text-terminal-muted">Topics</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ff3366]"></span>
                  <span className="text-terminal-muted">Frameworks</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span>
                  <span className="text-terminal-muted">Tools & AI Advisor</span>
                </div>
              </div>
              <p className="text-center text-[10px] text-terminal-muted/60 font-mono">
                Hover over pins to explore • Search to filter • Click to navigate
              </p>
            </div>
          </div>
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
