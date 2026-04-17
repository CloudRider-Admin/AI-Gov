/**
 * Circuit breaker for OpenAI API calls.
 *
 * States:
 *   CLOSED  → normal operation, requests pass through
 *   OPEN    → too many failures, requests are rejected immediately
 *   HALF_OPEN → after cooldown, one probe request is allowed through
 *
 * Prevents cascading failures when OpenAI is down or rate-limited,
 * and avoids burning tokens on retries during outages.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Milliseconds to wait before transitioning from OPEN → HALF_OPEN (default: 60s) */
  cooldownMs?: number;
  /** Number of consecutive successes in HALF_OPEN to close the circuit (default: 2) */
  successThreshold?: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.cooldownMs = options?.cooldownMs ?? 60_000;
    this.successThreshold = options?.successThreshold ?? 2;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.remainingCooldownMs());
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check whether the circuit allows a request through.
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        // Check if cooldown has elapsed → transition to HALF_OPEN
        if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.cooldownMs) {
          this.state = 'HALF_OPEN';
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return true;
    }
  }

  /**
   * Record a successful call.
   */
  onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;

    if (this.state === 'HALF_OPEN' && this.consecutiveSuccesses >= this.successThreshold) {
      this.state = 'CLOSED';
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Record a failed call.
   */
  onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures++;

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN reopens immediately
      this.state = 'OPEN';
    } else if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Get remaining cooldown time in ms (0 if not in OPEN state).
   */
  remainingCooldownMs(): number {
    if (this.state !== 'OPEN' || !this.lastFailureTime) return 0;
    return Math.max(0, this.cooldownMs - (Date.now() - this.lastFailureTime));
  }

  /**
   * Get current circuit breaker statistics.
   */
  stats(): CircuitBreakerStats {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Force-reset the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }
}

/**
 * Error thrown when the circuit is open and requests are being rejected.
 */
export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Circuit breaker is open. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** Singleton circuit breaker for OpenAI calls */
export const openaiCircuit = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 60_000,
  successThreshold: 2,
});
