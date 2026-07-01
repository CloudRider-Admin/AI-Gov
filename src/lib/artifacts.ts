import { prisma } from './prisma';
import { dispatchWebhooks } from './webhooks';
import { writeAuditLog } from './audit';
import { REVIEW_STATUSES, type ReviewStatus } from './governanceEnums';

export { REVIEW_STATUSES };
export type { ReviewStatus };

export interface SaveArtifactParams {
  userId: string;
  conversationId?: string;
  type: 'intake' | 'document' | 'playbook';
  subType?: string;
  title: string;
  riskTier?: string;
  useCaseName?: string;
  content: object;
  markdownExport: string;
}

export async function saveArtifact(params: SaveArtifactParams): Promise<string> {
  const artifact = await prisma.generatedArtifact.create({
    data: {
      userId: params.userId,
      conversationId: params.conversationId ?? null,
      type: params.type,
      subType: params.subType ?? null,
      title: params.title,
      riskTier: params.riskTier ?? null,
      useCaseName: params.useCaseName ?? null,
      content: JSON.stringify(params.content),
      markdownExport: params.markdownExport,
    },
  });

  // Fire webhook for artifact creation
  dispatchWebhooks(params.userId, 'artifact.created', {
    artifactId: artifact.id,
    title: params.title,
    type: params.type,
    subType: params.subType,
    riskTier: params.riskTier,
  });

  return artifact.id;
}

export async function getUserArtifacts(
  userId: string,
  type?: string,
  limit = 50,
) {
  return prisma.generatedArtifact.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      subType: true,
      title: true,
      riskTier: true,
      useCaseName: true,
      createdAt: true,
      conversationId: true,
      reviewStatus: true,
      reviewedAt: true,
    },
  });
}

/**
 * Advance an artifact through the review workflow (Tier 2):
 * draft → in-review → approved. Records approver + timestamp on approval.
 */
export async function setArtifactReviewStatus(
  id: string,
  userId: string,
  status: ReviewStatus,
) {
  const existing = await prisma.generatedArtifact.findFirst({
    where: { id, userId },
    select: { id: true, title: true },
  });
  if (!existing) return null;

  const artifact = await prisma.generatedArtifact.update({
    where: { id },
    data: {
      reviewStatus: status,
      reviewedById: status === 'approved' ? userId : null,
      reviewedAt: status === 'approved' ? new Date() : null,
    },
    select: { id: true, reviewStatus: true, reviewedAt: true },
  });

  if (status === 'approved') {
    writeAuditLog({
      actorId: userId,
      action: 'artifact.approved',
      entityType: 'artifact',
      entityId: id,
      summary: `Approved document "${existing.title}"`,
    });
    dispatchWebhooks(userId, 'artifact.approved', { artifactId: id, title: existing.title });
  }

  return artifact;
}

export async function getArtifactById(id: string, userId: string) {
  return prisma.generatedArtifact.findFirst({
    where: { id, userId },
  });
}

export async function deleteArtifact(id: string, userId: string) {
  await prisma.generatedArtifact.deleteMany({
    where: { id, userId },
  });
}

// ── Versioning ──

/**
 * Create a new version of an existing artifact.
 * The new version points back to the original (root) artifact via parentId.
 */
export async function createArtifactVersion(
  originalId: string,
  userId: string,
  updates: { content: object; markdownExport: string; changeNote?: string },
): Promise<string> {
  const original = await prisma.generatedArtifact.findFirst({
    where: { id: originalId, userId },
  });
  if (!original) throw new Error('Artifact not found');

  // The root of the version chain: if the original already has a parentId, use that;
  // otherwise the original IS the root.
  const rootId = original.parentId ?? original.id;

  // Get the latest version number in this chain
  const latest = await prisma.generatedArtifact.findFirst({
    where: { OR: [{ id: rootId }, { parentId: rootId }], userId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 1) + 1;

  const newArtifact = await prisma.generatedArtifact.create({
    data: {
      userId: original.userId,
      conversationId: original.conversationId,
      type: original.type,
      subType: original.subType,
      title: original.title,
      riskTier: original.riskTier,
      useCaseName: original.useCaseName,
      content: JSON.stringify(updates.content),
      markdownExport: updates.markdownExport,
      version: nextVersion,
      parentId: rootId,
      changeNote: updates.changeNote ?? null,
    },
  });

  // Fire webhook for version creation
  dispatchWebhooks(userId, 'artifact.versioned', {
    artifactId: newArtifact.id,
    rootId,
    title: original.title,
    type: original.type,
    version: nextVersion,
    changeNote: updates.changeNote,
  });

  return newArtifact.id;
}

/**
 * Get the full version history for an artifact (by its ID or any version's ID).
 * Returns all versions ordered by version number ascending.
 */
export async function getArtifactVersions(artifactId: string, userId: string) {
  // First, find the artifact to determine the root
  const artifact = await prisma.generatedArtifact.findFirst({
    where: { id: artifactId, userId },
    select: { id: true, parentId: true },
  });
  if (!artifact) return [];

  const rootId = artifact.parentId ?? artifact.id;

  return prisma.generatedArtifact.findMany({
    where: {
      userId,
      OR: [{ id: rootId }, { parentId: rootId }],
    },
    orderBy: { version: 'asc' },
    select: {
      id: true,
      version: true,
      title: true,
      changeNote: true,
      createdAt: true,
    },
  });
}

/**
 * Rollback: set the "current" version by creating a copy of an older version
 * as the latest version in the chain.
 */
export async function rollbackArtifact(
  targetVersionId: string,
  userId: string,
): Promise<string> {
  const target = await prisma.generatedArtifact.findFirst({
    where: { id: targetVersionId, userId },
  });
  if (!target) throw new Error('Version not found');

  return createArtifactVersion(
    targetVersionId,
    userId,
    {
      content: JSON.parse(target.content),
      markdownExport: target.markdownExport,
      changeNote: `Rolled back to version ${target.version}`,
    },
  );
}