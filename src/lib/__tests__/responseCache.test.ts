import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseCache } from '../responseCache';

describe('ResponseCache', () => {
  let cache: ResponseCache<string>;

  beforeEach(() => {
    cache = new ResponseCache<string>({ maxSize: 5, ttlMs: 1000 });
  });

  it('should return undefined for cache miss', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should store and retrieve a value', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for expired entries', () => {
    // Create a cache with 1ms TTL
    const shortCache = new ResponseCache<string>({ maxSize: 5, ttlMs: 1 });
    shortCache.set('key1', 'value1');

    // Wait for expiration
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }

    expect(shortCache.get('key1')).toBeUndefined();
  });

  it('should evict LRU entries when at capacity', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4');
    cache.set('e', '5');

    // Access 'a' to make it most recently used
    cache.get('a');

    // Add a 6th entry — should evict 'b' (oldest untouched)
    cache.set('f', '6');

    expect(cache.get('a')).toBe('1'); // still there (was accessed)
    expect(cache.get('b')).toBeUndefined(); // evicted
    expect(cache.get('f')).toBe('6'); // new entry
  });

  it('should track hit/miss stats', () => {
    cache.set('a', '1');
    cache.get('a'); // hit
    cache.get('a'); // hit
    cache.get('b'); // miss

    const stats = cache.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
    expect(stats.size).toBe(1);
  });

  it('should prune expired entries', () => {
    const shortCache = new ResponseCache<string>({ maxSize: 10, ttlMs: 1 });
    shortCache.set('a', '1');
    shortCache.set('b', '2');

    // Wait for expiration
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }

    const pruned = shortCache.prune();
    expect(pruned).toBe(2);
    expect(shortCache.stats().size).toBe(0);
  });

  it('should clear all entries and reset stats', () => {
    cache.set('a', '1');
    cache.get('a');
    cache.clear();

    const stats = cache.stats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('should report has() correctly', () => {
    cache.set('a', '1');
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });
});

describe('ResponseCache.buildKey', () => {
  it('should produce same key for same query', () => {
    const k1 = ResponseCache.buildKey('What is GDPR?');
    const k2 = ResponseCache.buildKey('What is GDPR?');
    expect(k1).toBe(k2);
  });

  it('should normalize whitespace', () => {
    const k1 = ResponseCache.buildKey('What  is   GDPR?');
    const k2 = ResponseCache.buildKey('What is GDPR?');
    expect(k1).toBe(k2);
  });

  it('should be case-insensitive', () => {
    const k1 = ResponseCache.buildKey('What is GDPR?');
    const k2 = ResponseCache.buildKey('what is gdpr?');
    expect(k1).toBe(k2);
  });

  it('should differ when context differs', () => {
    const k1 = ResponseCache.buildKey('risk assessment', 'healthcare');
    const k2 = ResponseCache.buildKey('risk assessment', 'finance');
    expect(k1).not.toBe(k2);
  });

  it('should differ with and without context', () => {
    const k1 = ResponseCache.buildKey('risk assessment');
    const k2 = ResponseCache.buildKey('risk assessment', 'context');
    expect(k1).not.toBe(k2);
  });
});
