import { describe, expect, it } from 'vitest';

import { classifyIntent } from '../intentClassifier';

const PROMPT_BY_TYPE: Record<string, string> = {
  'govsecure-aup': 'Generate an Acceptable Use Policy for our 280-person ecommerce SMB using ChatGPT Enterprise.',
  'govsecure-governance-policy': 'Create an AI Governance Policy for our healthcare network deploying a clinical triage co-pilot.',
  'govsecure-data-privacy-policy': 'Draft an AI Data Privacy Policy for our fintech loan pre-qualification model handling EU subscribers.',
  'govsecure-risk-approval-policy': 'Write an AI Risk and Approval Policy for our manufacturing predictive maintenance vision system.',
  'govsecure-security-policy': 'Generate an AI Security Policy for our public-sector constituent inquiry chatbot deployment.',
  'govsecure-incident-response-policy': 'Produce an AI Incident Response Policy for our higher-ed essay grading assistant pilot.',
  'govsecure-human-oversight-policy': 'Write an AI Human Oversight Policy for our SaaS sales outreach auto-drafting tool.',
  'govsecure-vendor-policy': 'Generate an AI Vendor Policy for our retail vendor procurement program.',
  'govsecure-checklist-intake': 'Generate an AI Use Case Intake Checklist for our new fraud scoring initiative deployment.',
  'govsecure-checklist-vendor-dd': 'Create a Vendor Due Diligence Checklist for our shortlisted GenAI SaaS vendors.',
  'govsecure-checklist-shadow-ai': 'Build a Shadow AI Discovery Checklist for our internal compliance sweep across departments.',
  'govsecure-checklist-inventory': 'Draft an AI Inventory Checklist for our enterprise system registry deployment.',
  'govsecure-checklist-model-validation': 'Generate a Model Validation and Testing Checklist for our credit risk model deployment.',
  'govsecure-checklist-monitoring': 'Create an AI Monitoring Checklist for our production fraud detection model deployment.',
  'govsecure-checklist-security': 'Write an AI Security Review Checklist for our internal RAG application deployment.',
  'govsecure-checklist-dpia': 'Generate a DPIA Screening Checklist for our marketing personalization engine deployment.',
  'govsecure-checklist-human-oversight': 'Draft a Human Oversight and Escalation Checklist for our triage assistant deployment.',
  'govsecure-checklist-change-management': 'Generate an AI Change Management Checklist for our quarterly model refresh deployment.',
  'govsecure-checklist-training': 'Create a Training and Role-Based Awareness Checklist for new joiner onboarding sessions.',
  'govsecure-checklist-risk-assessment': 'Generate a Risk Assessment Checklist for our new AI use case deployment.',
};

describe('intentClassifier — GovSecure document types', () => {
  for (const [expectedType, prompt] of Object.entries(PROMPT_BY_TYPE)) {
    it(`classifies "${prompt.slice(0, 60)}…" as ${expectedType}`, () => {
      const intent = classifyIntent(prompt, false);
      expect(intent.type).toBe('document');
      expect(intent.documentType).toBe(expectedType);
    });
  }

  it('still classifies the original generic types correctly', () => {
    expect(classifyIntent('Generate a DPIA for our processing.', false).documentType).toBe('dpia');
    expect(classifyIntent('Create a model card for our embedding model.', false).documentType).toBe('model-card');
  });
});
