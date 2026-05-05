"use client";

import type { ComponentType } from "react";
import {
  BookOpen,
  FileText,
  Target,
  AlertTriangle,
  Shield,
  Heart,
  Settings,
  GraduationCap,
  Rocket,
  Zap,
} from "lucide-react";

export type IconName =
  | "BookOpen"
  | "FileText"
  | "Target"
  | "AlertTriangle"
  | "Shield"
  | "Heart"
  | "Settings"
  | "GraduationCap"
  | "Rocket"
  | "Zap";

interface PageHeaderProps {
  tag?: string;
  title: string;
  description?: string;
  iconName?: IconName;
  level?: "beginner" | "intermediate" | "leadership";
}

const iconMap: Record<IconName, ComponentType<{ className?: string }>> = {
  BookOpen,
  FileText,
  Target,
  AlertTriangle,
  Shield,
  Heart,
  Settings,
  GraduationCap,
  Rocket,
  Zap,
};

const levelStyles = {
  beginner: "tag-beginner",
  intermediate: "tag-intermediate",
  leadership: "tag-leadership",
};

export function PageHeader({ tag, title, description, iconName, level }: PageHeaderProps) {
  const Icon = iconName ? iconMap[iconName] : null;

  return (
    <header className="mb-12">
      {/* Tag or Level badge */}
      <div className="flex items-center gap-3 mb-4">
        {tag && (
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider">
            {tag}
          </span>
        )}
        {level && (
          <span className={`tag ${levelStyles[level]}`}>
            {level}
          </span>
        )}
      </div>

      {/* Title with optional icon */}
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center border-2 border-terminal-green/30 rounded-md bg-terminal-green/5">
            <Icon className="w-7 h-7 text-terminal-green" />
          </div>
        )}
        <div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-terminal-text mb-4">
            {title}
          </h1>
          {description && (
            <p className="text-lg text-terminal-muted font-sans max-w-3xl">
              {description}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
