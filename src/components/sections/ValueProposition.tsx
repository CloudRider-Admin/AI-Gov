"use client";

import { valueProps } from "@/data/content";
import { ShieldCheck, Heart, Rocket } from "lucide-react";

const iconMap = {
  "reduce-risk": ShieldCheck,
  "protect-trust": Heart,
  "scale-control": Rocket,
};

export function ValueProposition() {
  return (
    <section className="section">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="section-title">
            Why AI Governance Matters for SMBs{" "}
            <span className="text-terminal-green">(Right Now)</span>
          </h2>
          <p className="section-subtitle mx-auto">
            The regulatory landscape is shifting. Early movers gain competitive advantage.
          </p>
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {valueProps.map((prop) => {
            const Icon = iconMap[prop.id as keyof typeof iconMap] || ShieldCheck;
            return (
              <div key={prop.id} className="card">
                {/* Icon */}
                <div className="w-14 h-14 mb-6 flex items-center justify-center border-2 border-terminal-green/30 rounded-lg bg-terminal-green/5">
                  <Icon className="w-7 h-7 text-terminal-green" />
                </div>

                {/* Title */}
                <h3 className="font-mono text-xl font-bold text-terminal-text mb-3">
                  {prop.title}
                </h3>

                {/* Description */}
                <p className="text-terminal-muted font-sans mb-6 leading-relaxed">
                  {prop.description}
                </p>

                {/* Highlights as tags */}
                <div className="flex flex-wrap gap-2">
                  {prop.highlights.map((highlight, index) => (
                    <span
                      key={index}
                      className="inline-flex px-2 py-1 text-xs font-mono text-terminal-muted border border-terminal-border rounded bg-terminal-gray/50"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
