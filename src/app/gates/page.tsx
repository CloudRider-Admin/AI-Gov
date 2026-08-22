import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { getGateBoard, getGateSummary } from '@/lib/gates/gates';
import { GatesBoardClient } from './GatesBoardClient';

export const metadata: Metadata = {
  title: 'Governance Gates',
  description:
    'Every use case, agent, and model moving through intake, evaluation, and approval.',
};

export default async function GatesPage() {
  const session = await requireSession();
  const [board, summary] = await Promise.all([
    getGateBoard(session.user.id),
    getGateSummary(session.user.id),
  ]);

  return <GatesBoardClient board={board} summary={summary} />;
}
