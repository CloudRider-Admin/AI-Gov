"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm font-mono text-terminal-muted mb-8">
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-terminal-green transition-colors"
      >
        <Home className="w-4 h-4" />
        <span className="sr-only">Home</span>
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4" />
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-terminal-green transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-terminal-text">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
