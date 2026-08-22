import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Hoisted mock handles so the vi.mock factory can reference them.
const { txMock, deleteManyMock, transactionMock } = vi.hoisted(() => ({
  txMock: {
    rateLimit: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
  deleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
    rateLimit: { deleteMany: deleteManyMock },
  },
}));

import { checkIpRateLimit, getClientIp } from '../rate-limit';

function fakeRequest(headers: Record<string, string>): NextRequest {
  return new Request('http://localhost', { headers }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction runs its callback with our fake tx client.
  transactionMock.mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock));
  txMock.rateLimit.create.mockResolvedValue({});
  deleteManyMock.mockResolvedValue({ count: 0 });
});

describe('getClientIp', () => {
  it('takes the first entry of x-forwarded-for', () => {
    expect(getClientIp(fakeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    expect(getClientIp(fakeRequest({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('returns "unknown" when no proxy headers are present', () => {
    expect(getClientIp(fakeRequest({}))).toBe('unknown');
  });
});

describe('checkIpRateLimit', () => {
  const request = fakeRequest({ 'x-forwarded-for': '1.2.3.4' });

  it('allows and records when under the limit', async () => {
    txMock.rateLimit.count.mockResolvedValue(2);

    const result = await checkIpRateLimit(request, 'contact', 5, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 5 - 2 - 1
    expect(result.limit).toBe(5);
    expect(txMock.rateLimit.create).toHaveBeenCalledOnce();
  });

  it('denies without recording when at the limit', async () => {
    txMock.rateLimit.count.mockResolvedValue(5);
    txMock.rateLimit.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min into a 60 min window
    });

    const result = await checkIpRateLimit(request, 'contact', 5, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(txMock.rateLimit.create).not.toHaveBeenCalled();
  });
});
