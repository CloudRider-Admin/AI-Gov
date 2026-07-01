import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { TeamClient } from './TeamClient';

export const metadata: Metadata = {
  title: 'Team',
  description: 'Manage your workspace members and invitations.',
};

export default async function TeamPage() {
  const session = await requireSession();
  const canCreateOrg = ['TEAM', 'ENTERPRISE', 'ADMIN'].includes(session.user.role ?? 'FREE');
  return <TeamClient canCreateOrg={canCreateOrg} />;
}
