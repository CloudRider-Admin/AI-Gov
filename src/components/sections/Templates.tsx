"use client";

import Image from "next/image";
import Link from "next/link";
import { templates } from "@/data/content";
import { FileText, Download, ArrowRight } from "lucide-react";

export function Templates() {
  return (
    <section id="templates" className="section bg-terminal-dark/30 scroll-mt-20">
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
              Download, customize, and implement immediately.
            </p>
          </div>
          <Link href="/signup" className="btn-primary self-start md:self-auto">
            Access the Template Library
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Templates list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Link
              key={template.id}
              href="/signup"
              className="card group cursor-pointer flex items-center gap-4"
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 flex-shrink-0 border border-terminal-border rounded-lg bg-terminal-gray/50 overflow-hidden relative">
                <div className="absolute inset-0 grid-bg opacity-20" />
                <Image
                  src={template.category === "policy" ? "/policy-icon.svg" : "/template-icon.svg"}
                  alt="Template preview"
                  width={56}
                  height={56}
                  className="absolute inset-0 w-full h-full object-contain p-3 opacity-80"
                />
              </div>

              {/* Icon */}
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center border border-terminal-border rounded-lg bg-terminal-gray group-hover:border-terminal-green/50 transition-colors">
                <FileText className="w-6 h-6 text-terminal-green" />
              </div>

              {/* Content */}
              <div className="flex-grow min-w-0">
                <h3 className="font-mono text-base font-bold text-terminal-text group-hover:text-terminal-green transition-colors truncate">
                  {template.title}
                </h3>
                <p className="text-terminal-muted font-sans text-sm truncate">
                  {template.description}
                </p>
              </div>

              {/* Download action */}
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-terminal-border rounded-lg bg-terminal-gray opacity-0 group-hover:opacity-100 transition-opacity">
                <Download className="w-5 h-5 text-terminal-green" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
