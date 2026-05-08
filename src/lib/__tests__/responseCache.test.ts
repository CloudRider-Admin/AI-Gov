import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseCache, buildArtifactKey, hashOrgContext } from '../responseCache';

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

describe('buildArtifactKey (Phase 7.3)', () => {
  const base = {
    intentType: 'document',
    documentType: 'dpia',
    framework: undefined,
    useCaseDescription: 'Hiring AI screening resumes',
    orgContextHash: 'abc123',
    role: 'PRO',
  };

  it('produces a stable key for the same inputs', () => {
    expect(buildArtifactKey(base)).toBe(buildArtifactKey({ ...base }));
  });

  it('normalizes whitespace and case in the use-case description', () => {
    const k1 = buildArtifactKey({ ...base, useCaseDescription: '  Hiring AI   screening RESUMES  ' });
    const k2 = buildArtifactKey({ ...base, useCaseDescription: 'hiring ai screening resumes' });
    expect(k1).toBe(k2);
  });

  it('differs when intentType changes', () => {
    expect(buildArtifactKey(base)).not.toBe(buildArtifactKey({ ...base, intentType: 'intake' }));
  });

  it('differs when documentType changes', () => {
    expect(buildArtifactKey(base)).not.toBe(buildArtifactKey({ ...base, documentType: 'threat-model' }));
  });

  it('differs when role changes', () => {
    expect(buildArtifactKey(base)).not.toBe(buildArtifactKey({ ...base, role: 'TEAM' }));
  });

  it('differs when org context hash changes', () => {
    expect(buildArtifactKey(base)).not.toBe(buildArtifactKey({ ...base, orgContextHash: 'def456' }));
  });

  it('differs when org context hash is omitted', () => {
    expect(buildArtifactKey(base)).not.toBe(buildArtifactKey({ ...base, orgContextHash: undefined }));
  });

  it('differs when framework is added vs omitted', () => {
    const withFramework = buildArtifactKey({ ...base, framework: 'NIST' });
    expect(buildArtifactKey(base)).not.toBe(withFramework);
  });

  it('returns a 16-char hex prefix', () => {
    const key = buildArtifactKey(base);
    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('hashOrgContext (Phase 7.3)', () => {
  it('returns undefined for undefined input', () => {
    expect(hashOrgContext(undefined)).toBeUndefined();
  });

  it('returns undefined for null input', () => {
    expect(hashOrgContext(null)).toBeUndefined();
  });

  it('returns a stable 12-char hex hash', () => {
    const ctx = { industry: 'healthcare', jurisdictions: ['EU'] };
    const h = hashOrgContext(ctx);
    expect(h).toMatch(/^[0-9a-f]{12}$/);
    expect(hashOrgContext({ ...ctx })).toBe(h);
  });

  it('produces the same hash regardless of key insertion order', () => {
    const a = { industry: 'finance', tools: ['gpt-4'] };
    const b = { tools: ['gpt-4'], industry: 'finance' };
    expect(hashOrgContext(a)).toBe(hashOrgContext(b));
  });

  it('produces different hashes for different content', () => {
    expect(hashOrgContext({ industry: 'healthcare' })).not.toBe(
      hashOrgContext({ industry: 'finance' }),
    );
  });
});