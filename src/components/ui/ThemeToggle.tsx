"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        className={`p-2 rounded-lg border border-terminal-border transition-colors ${className}`}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="w-4 h-4 text-terminal-muted" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg border border-terminal-border hover:border-terminal-green/50 transition-colors ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-terminal-muted hover:text-terminal-amber transition-colors" />
      ) : (
        <Moon className="w-4 h-4 text-terminal-muted hover:text-terminal-green transition-colors" />
      )}
    </button>
  );
}
