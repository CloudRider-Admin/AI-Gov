import { describe, it, expect, beforeEach, vi } from 'vitest';

const { queryRawUnsafeMock } = vi.hoisted(() => ({
  queryRawUnsafeMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRawUnsafe: queryRawUnsafeMock },
}));

import { GET } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('returns 200 / ok when the database is reachable', async () => {
    queryRawUnsafeMock.mockResolvedValue([{ '?column?': 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('up');
    expect(typeof body.services.openai).toBe('boolean');
  });

  it('returns 503 / degraded when the database is unreachable', async () => {
    queryRawUnsafeMock.mockRejectedValue(new Error('connection refused'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('down');
  });
});
