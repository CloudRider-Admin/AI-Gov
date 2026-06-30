"use client";

import Link from "next/link";
import { templates } from "@/data/content";
import { FileText, Download, ArrowRight } from "lucide-react";

export function Templates() {
  return (
    <section id="templates" className="section bg-terminal-dark scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
          <div>
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-2 block">
              Tools & Templates
            </span>
            <h2 className="section-title">
              Ready-to-Use Governance Assets
            </h2>
            <p className="section-subtitle">
              Free to download, customize, and implement immediately.
            </p>
          </div>
          <Link href="/govi" className="btn-primary self-start md:self-auto">
            Generate with AI — Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Templates list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Link
              key={template.id}
              href="/govi"
              className="card group cursor-pointer flex items-center gap-4"
            >
              {/* Icon */}
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center border border-terminal-border rounded-md bg-terminal-gray group-hover:border-terminal-green/50 transition-colors">
                <FileText className="w-6 h-6 text-terminal-green" />
              </div>

              {/* Content */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-mono text-base font-bold text-terminal-text group-hover:text-terminal-green transition-colors truncate">
                    {template.title}
                  </h3>
                  <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-terminal-green/15 text-terminal-green border border-terminal-green/30">
                    FREE
                  </span>
                </div>
                <p className="text-terminal-muted font-sans text-sm truncate">
                  {template.description}
                </p>
              </div>

              {/* Download action */}
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-terminal-border rounded-md bg-terminal-gray opacity-0 group-hover:opacity-100 transition-opacity">
                <Download className="w-5 h-5 text-terminal-green" />
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-xs font-mono text-terminal-muted">
          No credit card required · No sign-up needed · Generate custom versions with AI
        </p>
      </div>
    </section>
  );
}
