import { describe, it, expect } from 'vitest';
import { MONTHLY_TOKEN_BUDGETS, getMonthStart } from '../tokenBudget';

describe('MONTHLY_TOKEN_BUDGETS', () => {
  it('should have budgets for all plan tiers', () => {
    expect(MONTHLY_TOKEN_BUDGETS.GUEST).toBe(2_000);
    expect(MONTHLY_TOKEN_BUDGETS.FREE).toBe(20_000);
    expect(MONTHLY_TOKEN_BUDGETS.PRO).toBe(500_000);
    expect(MONTHLY_TOKEN_BUDGETS.TEAM).toBe(2_000_000);
    expect(MONTHLY_TOKEN_BUDGETS.ENTERPRISE).toBe(10_000_000);
    expect(MONTHLY_TOKEN_BUDGETS.ADMIN).toBe(Infinity);
  });

  it('should have increasing budgets per tier', () => {
    expect(MONTHLY_TOKEN_BUDGETS.GUEST).toBeLessThan(MONTHLY_TOKEN_BUDGETS.FREE);
    expect(MONTHLY_TOKEN_BUDGETS.FREE).toBeLessThan(MONTHLY_TOKEN_BUDGETS.PRO);
    expect(MONTHLY_TOKEN_BUDGETS.PRO).toBeLessThan(MONTHLY_TOKEN_BUDGETS.TEAM);
    expect(MONTHLY_TOKEN_BUDGETS.TEAM).toBeLessThan(MONTHLY_TOKEN_BUDGETS.ENTERPRISE);
  });
});

describe('getMonthStart', () => {
  it('should return the first day of the current month', () => {
    const start = getMonthStart();
    expect(start.getUTCDate()).toBe(1);
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
    expect(start.getUTCMilliseconds()).toBe(0);
  });

  it('should be in the current month and year', () => {
    const now = new Date();
    const start = getMonthStart();
    expect(start.getUTCMonth()).toBe(now.getUTCMonth());
    expect(start.getUTCFullYear()).toBe(now.getUTCFullYear());
  });

  it('should be in the past or now', () => {
    const start = getMonthStart();
    expect(start.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
