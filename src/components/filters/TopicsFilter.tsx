"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ArrowUpRight, Target, AlertTriangle, Shield, Heart, Settings, LucideIcon } from "lucide-react";
import { filterTopics, type CategoryFilter } from "@/lib/search";
import type { Category } from "@/data/topics";

interface TopicsFilterProps {
  categories: Category[];
}

const iconMap: Record<string, LucideIcon> = {
  Target,
  AlertTriangle,
  Shield,
  Heart,
  Settings,
};

export function TopicsFilter({ categories }: TopicsFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredCategories = useMemo(() => {
    return filterTopics(categories, categoryFilter, searchQuery);
  }, [categories, categoryFilter, searchQuery]);

  const totalTopics = categories.reduce((acc, cat) => acc + cat.topics.length, 0);
  const filteredTopics = filteredCategories.reduce((acc, cat) => acc + cat.topics.length, 0);

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
            placeholder="Search topics..."
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

        {/* Desktop category filter */}
        <div className="hidden sm:block">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-terminal-dark border border-terminal-border rounded-md font-mono text-sm text-terminal-text focus:outline-none focus:border-terminal-green/50 transition-colors cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile filters (collapsible) */}
      {showFilters && (
        <div className="sm:hidden mb-6 p-4 bg-terminal-dark/50 border border-terminal-border rounded-xl">
          <label className="block text-xs font-mono text-terminal-muted mb-2">
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-terminal-dark border border-terminal-border rounded-md font-mono text-sm text-terminal-text focus:outline-none focus:border-terminal-green/50"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Results count */}
      <div className="mb-6 text-sm font-mono text-terminal-muted">
        Showing {filteredTopics} of {totalTopics} topics in {filteredCategories.length} categories
        {categoryFilter !== "all" && (
          <span className="ml-2">
            • Filtered by <span className="text-terminal-green">{categories.find(c => c.id === categoryFilter)?.name}</span>
          </span>
        )}
        {searchQuery && (
          <span className="ml-2">
            • Searching &quot;<span className="text-terminal-green">{searchQuery}</span>&quot;
          </span>
        )}
      </div>

      {/* Categories and topics */}
      {filteredCategories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-terminal-muted font-mono">
            No topics found matching your criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
            }}
            className="mt-4 text-terminal-green font-mono text-sm hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredCategories.map((category) => {
            const Icon = iconMap[category.icon] || Target;

            return (
              <section key={category.id} className="card p-8">
                {/* Category header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 flex items-center justify-center border border-terminal-border rounded-xl bg-terminal-gray">
                    <Icon className="w-7 h-7 text-terminal-green" />
                  </div>
                  <div>
                    <Link
                      href={`/topics/${category.slug}`}
                      className="font-mono text-xl font-bold text-terminal-text hover:text-terminal-green transition-colors"
                    >
                      {category.name}
                    </Link>
                    <p className="text-terminal-muted font-sans text-sm mt-1">
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* Topics grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.topics.map((topic) => (
                    <Link
                      key={topic.id}
                      href={`/topics/${category.slug}/${topic.slug}`}
                      className="group p-4 border border-terminal-border rounded-xl hover:border-terminal-green/50 hover:bg-terminal-green/5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-mono text-sm font-semibold text-terminal-text group-hover:text-terminal-green transition-colors">
                          {topic.title}
                        </h3>
                        <ArrowUpRight className="w-4 h-4 text-terminal-green opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                      <p className="text-terminal-muted text-xs font-sans mt-1 line-clamp-2">
                        {topic.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
