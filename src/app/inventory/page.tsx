import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { listAiSystems, getInventorySummary } from '@/lib/aiSystems';
import { InventoryClient } from './InventoryClient';

export const metadata: Metadata = {
  title: 'AI System Inventory',
  description: 'Registry of every AI system your organization runs, with risk tiering and review cadence.',
};

export default async function InventoryPage() {
  const session = await requireSession();
  const [systems, summary] = await Promise.all([
    listAiSystems(session.user.id),
    getInventorySummary(session.user.id),
  ]);

  // Dates aren't serializable across the server/client boundary as-is; hand the
  // client plain ISO strings.
  const initialSystems = systems.map((s) => ({
    ...s,
    deployedAt: s.deployedAt?.toISOString() ?? null,
    lastReviewedAt: s.lastReviewedAt?.toISOString() ?? null,
    nextReviewAt: s.nextReviewAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return <InventoryClient initialSystems={initialSystems} summary={summary} />;
}
