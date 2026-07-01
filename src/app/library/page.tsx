import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { getUserArtifacts } from '@/lib/artifacts';
import { listUserDocuments } from '@/lib/userDocuments';
import { LibraryClient } from './LibraryClient';

export const metadata: Metadata = {
  title: 'Document Library',
  description: 'Your generated governance documents and their review status.',
};

export default async function LibraryPage() {
  const session = await requireSession();
  const [artifacts, userDocs] = await Promise.all([
    getUserArtifacts(session.user.id, undefined, 100),
    listUserDocuments(session.user.id),
  ]);
  const initialDocs = userDocs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    framework: d.framework,
    chunkCount: d.chunkCount,
    createdAt: d.createdAt.toISOString(),
  }));
  const initial = artifacts.map((a) => ({
    id: a.id,
    type: a.type,
    subType: a.subType,
    title: a.title,
    riskTier: a.riskTier,
    useCaseName: a.useCaseName,
    reviewStatus: a.reviewStatus,
    reviewedAt: a.reviewedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
  return <LibraryClient initialArtifacts={initial} initialUserDocs={initialDocs} />;
}
