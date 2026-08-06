import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { SettingsClient } from './SettingsClient';
import type { GoviInterface } from '@/components/advisor/useGoviInterface';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Personalize your Govi workspace, including your interface style.',
};

export default async function SettingsPage() {
  const session = await requireSession();

  const user = await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { goviInterface: true },
    })
    .catch(() => null);

  const initialInterface = (user?.goviInterface as GoviInterface) ?? 'terminal';

  return <SettingsClient initialInterface={initialInterface} />;
}
