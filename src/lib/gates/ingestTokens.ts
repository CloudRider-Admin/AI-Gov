/**
 * Bearer tokens for unattended evaluation ingestion.
 *
 * Follows the same shape as the org invitation tokens: a random 32-byte secret
 * shown to the caller exactly once, with only its SHA-256 hash persisted. A
 * leaked database therefore yields no usable tokens.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { prisma } from '../prisma';
import { writeAuditLog } from '../audit';

const TOKEN_PREFIX = 'gsk_';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface CreatedToken {
  id: string;
  name: string;
  prefix: string;
  /** Plaintext token — returned once, never stored, never recoverable. */
  token: string;
  createdAt: Date;
}

export async function createIngestToken(params: {
  userId: string;
  organizationId?: string | null;
  name: string;
}): Promise<CreatedToken> {
  const raw = `${TOKEN_PREFIX}${randomBytes(32).toString('hex')}`;
  const prefix = raw.slice(0, 12);

  const record = await prisma.ingestToken.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId ?? null,
      name: params.name.trim(),
      tokenHash: hashToken(raw),
      prefix,
    },
  });

  await writeAuditLog({
    actorId: params.userId,
    organizationId: params.organizationId,
    action: 'ingest_token.created',
    entityType: 'ingest_token',
    entityId: record.id,
    summary: `Created evaluation ingestion token "${record.name}" (${prefix}…)`,
  });

  return { id: record.id, name: record.name, prefix, token: raw, createdAt: record.createdAt };
}

export async function listIngestTokens(userId: string) {
  return prisma.ingestToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeIngestToken(userId: string, id: string) {
  const token = await prisma.ingestToken.findUnique({ where: { id } });
  if (!token || token.userId !== userId || token.revokedAt) return null;

  const revoked = await prisma.ingestToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    actorId: userId,
    organizationId: token.organizationId,
    action: 'ingest_token.revoked',
    entityType: 'ingest_token',
    entityId: id,
    summary: `Revoked evaluation ingestion token "${token.name}" (${token.prefix}…)`,
  });

  return revoked;
}

export interface ResolvedToken {
  userId: string;
  organizationId: string | null;
  tokenId: string;
}

/**
 * Resolve an `Authorization: Bearer …` header to its owner.
 *
 * The lookup is by hash, which is already constant-time in the index, but the
 * final comparison is done with timingSafeEqual so a malformed-but-close token
 * cannot be distinguished by response timing.
 */
export async function resolveIngestToken(authHeader: string | null): Promise<ResolvedToken | null> {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const raw = match[1].trim();
  if (!raw.startsWith(TOKEN_PREFIX)) return null;

  const hash = hashToken(raw);
  const record = await prisma.ingestToken.findUnique({ where: { tokenHash: hash } });
  if (!record || record.revokedAt) return null;

  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(record.tokenHash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Fire-and-forget: a failed timestamp write must not fail the ingestion.
  prisma.ingestToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => console.error('[ingestTokens] Failed to record last use:', err));

  return { userId: record.userId, organizationId: record.organizationId, tokenId: record.id };
}
