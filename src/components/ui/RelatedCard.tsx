"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface RelatedCardProps {
  title: string;
  description: string;
  href: string;
  level?: "beginner" | "intermediate" | "leadership";
}

const levelStyles = {
  beginner: "tag-beginner",
  intermediate: "tag-intermediate",
  leadership: "tag-leadership",
};

export function RelatedCard({ title, description, href, level }: RelatedCardProps) {
  return (
    <Link href={href} className="card group block">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-mono text-base font-bold text-terminal-text group-hover:text-terminal-green transition-colors">
          {title}
        </h3>
        <ArrowUpRight className="w-4 h-4 text-terminal-green opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
      <p className="text-terminal-muted font-sans text-sm line-clamp-2 mb-3">
        {description}
      </p>
      {level && (
        <span className={`tag ${levelStyles[level]}`}>
          {level}
        </span>
      )}
    </Link>
  );
}
