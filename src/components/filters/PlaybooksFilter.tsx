"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BookOpen, ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { filterPlaybooks, sortPlaybooks, type LevelFilter, type SortOption } from "@/lib/search";
import type { Playbook } from "@/data/content";

interface PlaybooksFilterProps {
  playbooks: Playbook[];
}

const levelStyles = {
  beginner: "tag-beginner",
  intermediate: "tag-intermediate",
  leadership: "tag-leadership",
};

const levelFilters: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All Levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "leadership", label: "Leadership" },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "title", label: "Title A-Z" },
  { value: "level", label: "By Level" },
];

export function PlaybooksFilter({ playbooks }: PlaybooksFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const filteredPlaybooks = useMemo(() => {
    const filtered = filterPlaybooks(playbooks, levelFilter, searchQuery);
    return sortPlaybooks(filtered, sortBy);
  }, [playbooks, levelFilter, searchQuery, sortBy]);

  return (
    <div>
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search input */}
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search playbooks..."
            className="w-full pl-10 pr-4 py-2 bg-terminal-dark border border-terminal-border rounded-md font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:border-terminal-green/50 transition-colors"
          />
        </div>

        {/* Filter toggle (mobile) */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center justify-center gap-2 px-4 py-2 border border-terminal-border rounded-md text-terminal-muted hover:text-terminal-text hover:border-terminal-green/50 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="font-mono text-sm">Filters</span>
        </button>

        {/* Desktop filters */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            className="px-3 py-2 bg-terminal-dark border border-terminal-border rounded-md font-mono text-sm text-terminal-text focus:outline-none focus:border-terminal-green/50 transition-colors cursor-pointer"
          >
            {levelFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 bg-terminal-dark border border-terminal-border rounded-md font-mono text-sm text-terminal-text focus:outline-none focus:border-terminal-green/50 transition-colors cursor-pointer"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile filters (collapsible) */}
      {showFilters && (
        <div className="sm:hidden flex flex-col gap-3 mb-6 p-4 bg-terminal-dark/50 border border-terminal-border rounded-xl">
          <div>
            <label className="block text-xs font-mono text-terminal-muted mb-2">
              Level
            </label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
              className="w-full px-3 py-2 bg-terminal-dark border border-terminal-border rounded-md font-mono text-sm text-terminal-text focus:outline-none focus:border-terminal-green/50"
            >
              {levelFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-terminal-muted mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-2 bg-terminal-dark border border-terminal-border rounded-md font-mono text-sm text-terminal-text focus:outline-none focus:border-terminal-green/50"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="mb-6 text-sm font-mono text-terminal-muted">
        Showing {filteredPlaybooks.length} of {playbooks.length} playbooks
        {levelFilter !== "all" && (
          <span className="ml-2">
            • Filtered by <span className="text-terminal-green">{levelFilter}</span>
          </span>
        )}
        {searchQuery && (
          <span className="ml-2">
            • Searching &quot;<span className="text-terminal-green">{searchQuery}</span>&quot;
          </span>
        )}
      </div>

      {/* Playbooks grid */}
      {filteredPlaybooks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-terminal-muted font-mono">
            No playbooks found matching your criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setLevelFilter("all");
            }}
            className="mt-4 text-terminal-green font-mono text-sm hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaybooks.map((playbook) => (
            <Link
              key={playbook.id}
              href={`/playbooks/${playbook.slug}`}
              className="card group flex flex-col"
            >
              {/* Header with icon and tag */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 flex items-center justify-center border border-terminal-border rounded-md bg-terminal-gray group-hover:border-terminal-green/50 transition-colors">
                  <BookOpen className="w-5 h-5 text-terminal-green" />
                </div>
                <span className={`tag ${levelStyles[playbook.level]}`}>
                  {playbook.level}
                </span>
              </div>

              {/* Title */}
              <h2 className="font-mono text-lg font-bold text-terminal-text mb-2 group-hover:text-terminal-green transition-colors">
                {playbook.title}
              </h2>

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
      )}
    </div>
  );
}
