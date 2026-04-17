"use client";

import Link from "next/link";
import { audienceCards } from "@/data/content";
import { Briefcase, Shield, Cpu, Scale, LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Briefcase,
  Shield,
  Cpu,
  Scale,
};

// Map audience cards to relevant content pages
const audienceLinks: Record<string, string> = {
  "founders-execs": "/learn/getting-started",
  "cios-cisos": "/topics/security",
  "data-ai-teams": "/topics/operations",
  "compliance-legal": "/topics/risk-compliance",
};

export function Audience() {
  return (
    <section className="section bg-terminal-dark/30">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider">
            Who This Is For
          </span>
        </div>

        {/* Audience cards - horizontal strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {audienceCards.map((card, index) => {
            const Icon = iconMap[card.icon] || Briefcase;
            const href = audienceLinks[card.id] || "/learn/getting-started";
            return (
              <Link
                key={card.id}
                href={href}
                className="card group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icon */}
                <div className="w-12 h-12 mb-4 flex items-center justify-center border border-terminal-border rounded-lg bg-terminal-gray group-hover:border-terminal-green/50 transition-colors">
                  <Icon className="w-6 h-6 text-terminal-green" />
                </div>

                {/* Title */}
                <h3 className="font-mono text-lg font-bold text-terminal-text mb-2 group-hover:text-terminal-green transition-colors">
                  {card.title}
                </h3>

                {/* Description */}
                <p className="text-terminal-muted font-sans text-sm leading-relaxed">
                  {card.description}
                </p>

                {/* Hover indicator */}
                <div className="mt-4 flex items-center gap-2 text-terminal-green opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-mono">Learn more</span>
                  <span className="text-xs">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
