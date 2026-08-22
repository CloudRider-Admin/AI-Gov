/**
 * Where a user-registered webhook is allowed to point.
 *
 * A webhook URL is attacker-controlled input that the server then fetches, so
 * without a guard it is a server-side request forgery primitive: `https://` was
 * the only requirement, which happily accepts the cloud metadata service,
 * localhost, and anything on the internal network. Both the create path and the
 * dispatch path validate, because a hostname that resolved publicly at
 * registration can be repointed at a private address afterwards (DNS rebinding).
 */

import { lookup } from 'node:dns/promises';
import net from 'node:net';

export type TargetCheck = { allowed: true } | { allowed: false; reason: string };

/** Hostnames that are never a legitimate webhook target, whatever they resolve to. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain'];

/**
 * True for addresses that are not routable on the public internet: loopback,
 * link-local (which covers 169.254.169.254, the cloud metadata endpoint),
 * private ranges, carrier-grade NAT, and the IPv6 equivalents.
 */
export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);

  if (version === 4) {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true;                       // "this network"
    if (a === 10) return true;                      // private
    if (a === 127) return true;                     // loopback
    if (a === 169 && b === 254) return true;        // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true;        // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 192 && b === 0) return true;          // IETF protocol assignments
    if (a >= 224) return true;                      // multicast + reserved
    return false;
  }

  if (version === 6) {
    const addr = address.toLowerCase().replace(/^\[|\]$/g, '');
    if (addr === '::' || addr === '::1') return true;         // unspecified, loopback
    if (addr.startsWith('fe80')) return true;                  // link-local
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique local
    // IPv4-mapped (::ffff:169.254.169.254) — judge the embedded address.
    const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  // Not an IP literal — the caller resolves the hostname and re-checks.
  return false;
}

/** Structural check: scheme, port, and hostname shape. No DNS. */
export function checkWebhookUrl(rawUrl: string): TargetCheck {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'That is not a valid URL.' };
  }

  if (url.protocol !== 'https:') {
    return { allowed: false, reason: 'Webhook URLs must use https.' };
  }

  if (url.username || url.password) {
    return { allowed: false, reason: 'Webhook URLs must not embed credentials.' };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return { allowed: false, reason: 'That host is not reachable from GovSecure.' };
  }

  // A bare hostname with no dot is an internal name on most networks.
  if (!hostname.includes('.') && net.isIP(hostname) === 0) {
    return { allowed: false, reason: 'Use a fully qualified public hostname.' };
  }

  if (net.isIP(hostname) !== 0 && isPrivateAddress(hostname)) {
    return { allowed: false, reason: 'That address is on a private or reserved range.' };
  }

  return { allowed: true };
}

/**
 * Structural check plus DNS resolution, rejecting hostnames that resolve to a
 * private address. Run before every dispatch, not only at registration.
 */
export async function checkWebhookTarget(rawUrl: string): Promise<TargetCheck> {
  const structural = checkWebhookUrl(rawUrl);
  if (!structural.allowed) return structural;

  const hostname = new URL(rawUrl).hostname.toLowerCase().replace(/\.$/, '');
  if (net.isIP(hostname) !== 0) return { allowed: true }; // literal, already judged

  try {
    const records = await lookup(hostname, { all: true });
    if (records.length === 0) {
      return { allowed: false, reason: 'That hostname does not resolve.' };
    }
    if (records.some((r) => isPrivateAddress(r.address))) {
      return { allowed: false, reason: 'That hostname resolves to a private or reserved address.' };
    }
  } catch {
    return { allowed: false, reason: 'That hostname could not be resolved.' };
  }

  return { allowed: true };
}
