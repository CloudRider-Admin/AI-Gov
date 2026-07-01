/**
 * Client-safe definition of the onboarding maturity assessment (Tier 5).
 * A "no" answer maps to a recommended remediation task the API will seed.
 * No server imports so both the quiz UI and the processing route can use it.
 */

import type { TaskPriority } from './governanceEnums';

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  /** Recommended task created when the user answers "no". */
  remediation: {
    title: string;
    description: string;
    priority: TaskPriority;
    framework?: string;
    controlId?: string;
  };
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'inventory',
    prompt: 'Do you maintain an inventory of the AI systems and tools your business uses?',
    remediation: {
      title: 'Register your AI systems in the inventory',
      description: 'Create a register of every AI tool and model in use, with an owner and purpose for each.',
      priority: 'high',
    },
  },
  {
    id: 'risk-classification',
    prompt: 'Have you classified which of your AI systems are high-risk under the EU AI Act?',
    remediation: {
      title: 'Classify AI systems by EU AI Act risk category',
      description: 'Review each registered system and assign a risk category (prohibited, high, limited, minimal).',
      priority: 'high',
      framework: 'EU-AI-Act',
      controlId: 'ART-9',
    },
  },
  {
    id: 'policy',
    prompt: 'Do you have a written AI acceptable-use policy for staff?',
    remediation: {
      title: 'Publish an AI acceptable-use policy',
      description: 'Draft and circulate a policy covering approved tools, data handling, and human oversight.',
      priority: 'medium',
      framework: 'ISO-42001',
      controlId: 'A.2.2',
    },
  },
  {
    id: 'dpia',
    prompt: 'Do you run impact assessments (DPIAs) for AI systems that process personal data?',
    remediation: {
      title: 'Complete DPIAs for personal-data AI systems',
      description: 'Run a data protection impact assessment for each system handling personal or sensitive data.',
      priority: 'high',
      framework: 'EU-AI-Act',
      controlId: 'ART-10',
    },
  },
  {
    id: 'accountability',
    prompt: 'Is there a named person accountable for AI governance in your organization?',
    remediation: {
      title: 'Assign an AI governance owner',
      description: 'Designate an individual responsible for AI governance and document the reporting line.',
      priority: 'medium',
      framework: 'NIST-AI-RMF',
      controlId: 'GOVERN-2.1',
    },
  },
  {
    id: 'review-cadence',
    prompt: 'Do you review your AI systems on a regular schedule?',
    remediation: {
      title: 'Establish a periodic AI system review cadence',
      description: 'Set review dates for each system and monitor for drift, incidents, and regulatory change.',
      priority: 'medium',
      framework: 'NIST-AI-RMF',
      controlId: 'MANAGE-2.2',
    },
  },
];
