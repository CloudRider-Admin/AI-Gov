import { describe, it, expect } from 'vitest';
import { checkWebhookUrl, isPrivateAddress } from '../webhookTargets';

describe('isPrivateAddress', () => {
  it('rejects the cloud metadata endpoint', () => {
    // The single most valuable SSRF target on any cloud host.
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
  });

  it('rejects loopback and private ranges', () => {
    for (const addr of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1']) {
      expect(isPrivateAddress(addr)).toBe(true);
    }
  });

  it('rejects carrier-grade NAT and reserved space', () => {
    expect(isPrivateAddress('100.64.0.1')).toBe(true);
    expect(isPrivateAddress('0.0.0.0')).toBe(true);
    expect(isPrivateAddress('224.0.0.1')).toBe(true);
  });

  it('allows ordinary public addresses', () => {
    for (const addr of ['1.1.1.1', '8.8.8.8', '172.32.0.1', '192.169.0.1', '99.99.99.99']) {
      expect(isPrivateAddress(addr)).toBe(false);
    }
  });

  it('rejects IPv6 loopback, link-local, and unique-local', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
  });

  it('sees through an IPv4-mapped IPv6 address', () => {
    expect(isPrivateAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('allows public IPv6', () => {
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });
});

describe('checkWebhookUrl', () => {
  const allowed = (url: string) => checkWebhookUrl(url).allowed;

  it('accepts a normal https endpoint', () => {
    expect(allowed('https://hooks.slack.com/services/T000/B000/xxx')).toBe(true);
    expect(allowed('https://grc.example.gov/api/hooks/govsecure')).toBe(true);
  });

  it('rejects plain http', () => {
    expect(allowed('http://example.com/hook')).toBe(false);
  });

  it('rejects the metadata service by address and by name', () => {
    expect(allowed('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(allowed('https://metadata.google.internal/computeMetadata/v1/')).toBe(false);
  });

  it('rejects loopback however it is spelled', () => {
    expect(allowed('https://localhost/hook')).toBe(false);
    expect(allowed('https://127.0.0.1/hook')).toBe(false);
    expect(allowed('https://[::1]/hook')).toBe(false);
    // A trailing dot is still the same host to a resolver.
    expect(allowed('https://localhost./hook')).toBe(false);
  });

  it('rejects private literals and internal-looking names', () => {
    expect(allowed('https://10.1.2.3/hook')).toBe(false);
    expect(allowed('https://192.168.0.10:8443/hook')).toBe(false);
    expect(allowed('https://jenkins.internal/hook')).toBe(false);
    expect(allowed('https://printer.local/hook')).toBe(false);
    expect(allowed('https://intranet/hook')).toBe(false);
  });

  it('rejects credentials embedded in the URL', () => {
    expect(allowed('https://user:pass@example.com/hook')).toBe(false);
  });

  it('rejects a malformed URL rather than throwing', () => {
    expect(allowed('not a url')).toBe(false);
  });

  it('explains why it refused', () => {
    const result = checkWebhookUrl('https://169.254.169.254/');
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/private|reserved|reachable/i);
  });
});
