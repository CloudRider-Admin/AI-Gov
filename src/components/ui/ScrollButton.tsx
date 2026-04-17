"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function AdvisorButton() {
  return (
    <Link
      href="./govi"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 
      bg-terminal-green text-terminal-black font-mono text-sm font-semibold rounded-lg shadow-lg hover:bg-terminal-green-dim transition-all hover:scale-105"
    >
      <Sparkles className="w-4 h-4" />
      <span>Ask Govi</span>
    </Link>
  );
}