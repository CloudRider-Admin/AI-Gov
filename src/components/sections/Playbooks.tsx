"use client";

import Link from "next/link";
import { playbooks } from "@/data/content";
import { BookOpen, ArrowUpRight } from "lucide-react";

const levelStyles = {
  beginner: "tag-beginner",
  intermediate: "tag-intermediate",
  leadership: "tag-leadership",
};

export function Playbooks() {
  return (
    <section className="section bg-terminal-dark/30">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
          <div>
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-2 block">
              Governance Playbooks
            </span>
            <h2 className="section-title">
              Practical Guides for Every Stage
            </h2>
          </div>
          <Link href="/playbooks" className="btn-secondary self-start md:self-auto">
            View All Playbooks
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Playbook cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playbooks.map((playbook) => (
            <Link
              key={playbook.id}
              href={`/playbooks/${playbook.slug}`}
              className="card group flex flex-col"
            >
              {/* Header with icon and tag */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded bg-terminal-gray group-hover:border-terminal-green/50 transition-colors">
                  <BookOpen className="w-5 h-5 text-terminal-green" />
                </div>
                <span className={`tag ${levelStyles[playbook.level]}`}>
                  {playbook.level}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-mono text-lg font-bold text-terminal-text mb-2 group-hover:text-terminal-green transition-colors">
                {playbook.title}
              </h3>

              {/* Description */}
              <p className="text-terminal-muted font-sans text-sm leading-relaxed flex-grow">
                {playbook.description}
              </p>

              {/* Read link */}
              <div className="mt-4 pt-4 border-t border-terminal-border flex items-center justify-between">
                <span className="text-xs font-mono text-terminal-muted">
                  Read playbook
                </span>
                <ArrowUpRight className="w-4 h-4 text-terminal-green opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
