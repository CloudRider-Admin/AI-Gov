import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAuthorizedCron } from '../auth';

function req(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/cleanup', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('isAuthorizedCron', () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it('fails closed when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCron(req('Bearer anything'))).toBe(false);
  });

  describe('with a configured secret', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 's3cret';
    });

    it('accepts the correct bearer token', () => {
      expect(isAuthorizedCron(req('Bearer s3cret'))).toBe(true);
    });

    it('rejects a missing Authorization header', () => {
      expect(isAuthorizedCron(req())).toBe(false);
    });

    it('rejects a wrong token', () => {
      expect(isAuthorizedCron(req('Bearer wrong'))).toBe(false);
    });

    it('rejects a token without the Bearer scheme', () => {
      expect(isAuthorizedCron(req('s3cret'))).toBe(false);
    });
  });
});
