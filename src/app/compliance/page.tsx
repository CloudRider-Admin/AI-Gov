import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { getAllPostures } from '@/lib/compliance';
import { ComplianceClient } from './ComplianceClient';

export const metadata: Metadata = {
  title: 'Compliance Posture',
  description: 'Live control coverage across NIST AI RMF, ISO 42001, and the EU AI Act.',
};

export default async function CompliancePage() {
  const session = await requireSession();
  const frameworks = await getAllPostures(session.user.id);
  return <ComplianceClient initialFrameworks={frameworks} />;
}
