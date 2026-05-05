// Search utilities for global search functionality

import { playbooks, templates, type Playbook } from "@/data/content";
import { categories, getAllTopics, type Category } from "@/data/topics";

export type SearchResultType = "playbook" | "topic" | "template" | "category";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  href: string;
  category?: string;
  level?: "beginner" | "intermediate" | "leadership";
  score: number;
}

// Simple fuzzy matching score
function getMatchScore(query: string, text: string): number {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Exact match
  if (textLower === queryLower) return 100;
  
  // Starts with query
  if (textLower.startsWith(queryLower)) return 90;
  
  // Contains query as whole word
  const wordBoundary = new RegExp(`\\b${queryLower}\\b`, "i");
  if (wordBoundary.test(text)) return 80;
  
  // Contains query
  if (textLower.includes(queryLower)) return 70;
  
  // Check individual words
  const queryWords = queryLower.split(/\s+/);
  const matchedWords = queryWords.filter(word => textLower.includes(word));
  if (matchedWords.length > 0) {
    return 50 + (matchedWords.length / queryWords.length) * 30;
  }
  
  return 0;
}

// Search across all content
export function searchAll(query: string): SearchResult[] {
  if (!query || query.trim().length < 2) return [];
  
  const results: SearchResult[] = [];
  const normalizedQuery = query.trim();
  
  // Search playbooks
  playbooks.forEach((playbook) => {
    const titleScore = getMatchScore(normalizedQuery, playbook.title);
    const descScore = getMatchScore(normalizedQuery, playbook.description) * 0.7;
    const score = Math.max(titleScore, descScore);
    
    if (score > 0) {
      results.push({
        id: playbook.id,
        type: "playbook",
        title: playbook.title,
        description: playbook.description,
        href: `/playbooks/${playbook.slug}`,
        level: playbook.level,
        score,
      });
    }
  });
  
  // Search categories
  categories.forEach((category) => {
    const titleScore = getMatchScore(normalizedQuery, category.name);
    const descScore = getMatchScore(normalizedQuery, category.description) * 0.7;
    const score = Math.max(titleScore, descScore);
    
    if (score > 0) {
      results.push({
        id: category.id,
        type: "category",
        title: category.name,
        description: category.description,
        href: `/topics/${category.slug}`,
        category: "Topics",
        score,
      });
    }
  });
  
  // Search topics
  const allTopics = getAllTopics();
  allTopics.forEach((topic) => {
    const titleScore = getMatchScore(normalizedQuery, topic.title);
    const descScore = getMatchScore(normalizedQuery, topic.description) * 0.7;
    const score = Math.max(titleScore, descScore);
    
    if (score > 0) {
      // Find parent category
      const parentCategory = categories.find(c => 
        c.topics.some(t => t.id === topic.id)
      );
      
      results.push({
        id: topic.id,
        type: "topic",
        title: topic.title,
        description: topic.description,
        href: `/topics/${parentCategory?.slug}/${topic.slug}`,
        category: parentCategory?.name,
        score,
      });
    }
  });
  
  // Search templates
  templates.forEach((template) => {
    const titleScore = getMatchScore(normalizedQuery, template.title);
    const descScore = getMatchScore(normalizedQuery, template.description) * 0.7;
    const categoryScore = getMatchScore(normalizedQuery, template.category) * 0.5;
    const score = Math.max(titleScore, descScore, categoryScore);
    
    if (score > 0) {
      results.push({
        id: template.id,
        type: "template",
        title: template.title,
        description: template.description,
        href: "/#templates", // Templates section on homepage
        category: template.category,
        score,
      });
    }
  });
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

// Filter and sort utilities for listing pages
export type SortOption = "title" | "level" | "newest";
export type LevelFilter = "all" | "beginner" | "intermediate" | "leadership";

export function filterPlaybooks(
  items: Playbook[],
  level: LevelFilter,
  searchQuery: string
): Playbook[] {
  let filtered = [...items];
  
  // Filter by level
  if (level !== "all") {
    filtered = filtered.filter(p => p.level === level);
  }
  
  // Filter by search query
  if (searchQuery.trim()) {
    filtered = filtered.filter(p => {
      const score = Math.max(
        getMatchScore(searchQuery, p.title),
        getMatchScore(searchQuery, p.description)
      );
      return score > 0;
    });
  }
  
  return filtered;
}

export function sortPlaybooks(
  items: Playbook[],
  sortBy: SortOption
): Playbook[] {
  const sorted = [...items];
  
  switch (sortBy) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "level":
      const levelOrder = { beginner: 0, intermediate: 1, leadership: 2 };
      return sorted.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
    case "newest":
    default:
      return sorted; // Keep original order (assumed newest first)
  }
}

export type CategoryFilter = "all" | string;

export function filterTopics(
  allCategories: Category[],
  categoryFilter: CategoryFilter,
  searchQuery: string
): Category[] {
  let filtered = [...allCategories];
  
  // Filter by category
  if (categoryFilter !== "all") {
    filtered = filtered.filter(c => c.id === categoryFilter);
  }
  
  // Filter by search query
  if (searchQuery.trim()) {
    filtered = filtered.map(category => ({
      ...category,
      topics: category.topics.filter(topic => {
        const score = Math.max(
          getMatchScore(searchQuery, topic.title),
          getMatchScore(searchQuery, topic.description)
        );
        return score > 0;
      }),
    })).filter(c => c.topics.length > 0);
  }
  
  return filtered;
}
