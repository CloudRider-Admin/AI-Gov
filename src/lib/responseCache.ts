/**
 * In-memory response cache for advisor queries.
 *
 * Caches OpenAI responses keyed by a hash of (query + context).
 * Uses LRU eviction and a configurable TTL (default 24h).
 *
 * This avoids re-calling OpenAI for identical queries within the TTL window,
 * significantly reducing cost for repeated questions.
 */

import { createHash } from 'crypto';

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export class ResponseCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(options?: { maxSize?: number; ttlMs?: number }) {
    this.maxSize = options?.maxSize ?? 200;
    this.ttlMs = options?.ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Build a deterministic cache key from query + optional context + conversation + role.
   * Including conversationId prevents cross-conversation cache contamination.
   * Including role prevents gated/ungated response cross-contamination.
   */
  static buildKey(query: string, context?: string, conversationId?: string, role?: string): string {
    const parts = [query.trim().toLowerCase()];
    if (context) parts.push(context.trim().toLowerCase());
    if (conversationId) parts.push(conversationId);
    if (role) parts.push(role);
    const normalized = parts.join('|').replace(/\s+/g, ' ');
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  /**
   * Get a cached response. Returns undefined on miss or expired entry.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    entry.hits++;
    this.hits++;

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Store a response in the cache.
   */
  set(key: string, value: T): void {
    // Evict LRU entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      hits: 0,
    });
  }

  /**
   * Check if a non-expired entry exists for the key.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Remove all expired entries.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache performance statistics.
   */
  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

/** Singleton advisor response cache */
export const advisorCache = new ResponseCache({ maxSize: 200, ttlMs: 24 * 60 * 60 * 1000 });