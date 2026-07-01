import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-guard';
import { AssessmentClient } from './AssessmentClient';

export const metadata: Metadata = {
  title: 'Governance Assessment',
  description: 'Answer a few questions to get a personalized AI governance roadmap.',
};

export default async function AssessmentPage() {
  await requireSession();
  return <AssessmentClient />;
}
