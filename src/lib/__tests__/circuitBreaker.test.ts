import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../circuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 100,
      successThreshold: 2,
    });
  });

  it('should start in CLOSED state', () => {
    expect(breaker.stats().state).toBe('CLOSED');
  });

  it('should allow requests in CLOSED state', () => {
    expect(breaker.canExecute()).toBe(true);
  });

  it('should stay CLOSED on successes', async () => {
    await breaker.execute(() => Promise.resolve('ok'));
    await breaker.execute(() => Promise.resolve('ok'));

    const stats = breaker.stats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.totalSuccesses).toBe(2);
    expect(stats.consecutiveFailures).toBe(0);
  });

  it('should open after reaching failure threshold', () => {
    for (let i = 0; i < 3; i++) {
      breaker.onFailure();
    }
    expect(breaker.stats().state).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should throw CircuitOpenError when OPEN', async () => {
    for (let i = 0; i < 3; i++) breaker.onFailure();

    try {
      await breaker.execute(() => Promise.resolve('should not run'));
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitOpenError);
      expect((err as CircuitOpenError).retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('should transition to HALF_OPEN after cooldown', async () => {
    for (let i = 0; i < 3; i++) breaker.onFailure();
    expect(breaker.stats().state).toBe('OPEN');

    // Wait for cooldown
    await new Promise(r => setTimeout(r, 120));

    expect(breaker.canExecute()).toBe(true);
    expect(breaker.stats().state).toBe('HALF_OPEN');
  });

  it('should close after enough successes in HALF_OPEN', async () => {
    for (let i = 0; i < 3; i++) breaker.onFailure();

    // Wait for cooldown
    await new Promise(r => setTimeout(r, 120));

    // HALF_OPEN: 2 successes needed
    breaker.canExecute(); // triggers transition to HALF_OPEN
    breaker.onSuccess();
    expect(breaker.stats().state).toBe('HALF_OPEN');

    breaker.onSuccess();
    expect(breaker.stats().state).toBe('CLOSED');
  });

  it('should reopen on any failure in HALF_OPEN', async () => {
    for (let i = 0; i < 3; i++) breaker.onFailure();

    // Wait for cooldown
    await new Promise(r => setTimeout(r, 120));

    breaker.canExecute(); // triggers HALF_OPEN
    breaker.onFailure(); // should reopen immediately

    expect(breaker.stats().state).toBe('OPEN');
  });

  it('should reset consecutive failures on success', () => {
    breaker.onFailure();
    breaker.onFailure();
    breaker.onSuccess(); // resets counter

    expect(breaker.stats().consecutiveFailures).toBe(0);
    expect(breaker.stats().state).toBe('CLOSED');
  });

  it('should execute the function and return result', async () => {
    const result = await breaker.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('should propagate errors from the executed function', async () => {
    try {
      await breaker.execute(() => Promise.reject(new Error('OpenAI down')));
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('OpenAI down');
      expect(breaker.stats().consecutiveFailures).toBe(1);
    }
  });

  it('should force-reset to CLOSED', () => {
    for (let i = 0; i < 3; i++) breaker.onFailure();
    expect(breaker.stats().state).toBe('OPEN');

    breaker.reset();
    expect(breaker.stats().state).toBe('CLOSED');
    expect(breaker.stats().consecutiveFailures).toBe(0);
  });

  it('should track total stats across state transitions', async () => {
    // 2 failures
    breaker.onFailure();
    breaker.onFailure();
    // 1 success (resets consecutive)
    breaker.onSuccess();
    // 3 failures → OPEN
    breaker.onFailure();
    breaker.onFailure();
    breaker.onFailure();

    const stats = breaker.stats();
    expect(stats.totalFailures).toBe(5);
    expect(stats.totalSuccesses).toBe(1);
    expect(stats.state).toBe('OPEN');
  });
});

describe('CircuitOpenError', () => {
  it('should have correct name and retryAfterMs', () => {
    const err = new CircuitOpenError(30000);
    expect(err.name).toBe('CircuitOpenError');
    expect(err.retryAfterMs).toBe(30000);
    expect(err.message).toContain('30s');
  });
});
