/**
 * In-memory stream buffer for SSE streaming error recovery.
 *
 * Stores accumulated streaming content by streamId so that if a client
 * disconnects mid-stream, it can reconnect and resume from where it left off.
 *
 * Entries expire after 5 minutes and the buffer is capped at 100 entries (LRU).
 */

interface StreamEntry {
  content: string;
  complete: boolean;
  conversationId?: string;
  sources?: string[];
  createdAt: number;
}

export class StreamBuffer {
  private buffer = new Map<string, StreamEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(options?: { maxSize?: number; ttlMs?: number }) {
    this.maxSize = options?.maxSize ?? 100;
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Create a new stream entry.
   */
  create(streamId: string, conversationId?: string): void {
    this.evictExpired();

    // LRU eviction if at capacity
    if (this.buffer.size >= this.maxSize) {
      const oldestKey = this.buffer.keys().next().value;
      if (oldestKey !== undefined) {
        this.buffer.delete(oldestKey);
      }
    }

    this.buffer.set(streamId, {
      content: '',
      complete: false,
      conversationId,
      createdAt: Date.now(),
    });
  }

  /**
   * Append content chunk to a stream.
   */
  append(streamId: string, chunk: string): void {
    const entry = this.buffer.get(streamId);
    if (entry) {
      entry.content += chunk;
      // Move to end (most recently used)
      this.buffer.delete(streamId);
      this.buffer.set(streamId, entry);
    }
  }

  /**
   * Mark a stream as complete with optional sources.
   */
  complete(streamId: string, sources?: string[]): void {
    const entry = this.buffer.get(streamId);
    if (entry) {
      entry.complete = true;
      entry.sources = sources;
    }
  }

  /**
   * Get buffered content from a given offset.
   * Returns null if stream not found or expired.
   */
  getFrom(streamId: string, offset: number): { content: string; complete: boolean; sources?: string[] } | null {
    const entry = this.buffer.get(streamId);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.buffer.delete(streamId);
      return null;
    }

    return {
      content: entry.content.slice(offset),
      complete: entry.complete,
      sources: entry.sources,
    };
  }

  /**
   * Check if a stream exists and is not expired.
   */
  has(streamId: string): boolean {
    const entry = this.buffer.get(streamId);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.buffer.delete(streamId);
      return false;
    }
    return true;
  }

  /**
   * Get the conversation ID for a stream.
   */
  getConversationId(streamId: string): string | undefined {
    return this.buffer.get(streamId)?.conversationId;
  }

  /**
   * Remove expired entries.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.buffer) {
      if (now - entry.createdAt > this.ttlMs) {
        this.buffer.delete(key);
      }
    }
  }

  /**
   * Get current buffer size.
   */
  get size(): number {
    return this.buffer.size;
  }
}

/** Singleton stream buffer */
export const streamBuffer = new StreamBuffer();