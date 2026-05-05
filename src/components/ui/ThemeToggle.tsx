"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button
        className={`w-9 h-9 flex items-center justify-center rounded-full bg-terminal-text ${className}`}
        aria-label="Toggle theme"
        disabled
      >
        <Moon className="w-4 h-4 text-terminal-black" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`w-9 h-9 flex items-center justify-center rounded-full bg-terminal-text hover:opacity-80 transition-opacity ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {/* Moon = you're in light/day mode; Sun = you're in dark/night mode */}
      {theme === "light" ? (
        <Moon className="w-4 h-4 text-terminal-black" />
      ) : (
        <Sun className="w-4 h-4 text-terminal-black" />
      )}
    </button>
  );
}
