/**
 * Shared display metadata for every `DocumentType` Govi can generate.
 *
 * Phase 6 surface — replaces the kebab-case strings (e.g. `govsecure-aup`)
 * the UI rendered before with human labels and category badges. The registry
 * keys are the runtime `DOCUMENT_TYPE_VALUES`; the sync guard test
 * (`schemas.test.ts`) catches drift between this registry and the union.
 */

import type { DocumentType } from '@/types/documents';

export type DocumentCategory = 'generic' | 'govsecure-policy' | 'govsecure-checklist' | 'govsecure-flagship';

export interface DocumentTypeMeta {
  label: string;
  category: DocumentCategory;
  /** One-line hint used on hover / inside artifact summaries. */
  blurb: string;
}

const META: Record<DocumentType, DocumentTypeMeta> = {
  // ── Generic governance documents ──────────────────────────────────────────
  'use-case-summary': {
    label: 'Use Case Summary',
    category: 'generic',
    blurb: 'One-page description of the AI use case for stakeholders',
  },
  'data-sheet': {
    label: 'Data Sheet',
    category: 'generic',
    blurb: 'Datasets, sources, lineage, and quality notes',
  },
  'vendor-model-facts': {
    label: 'Vendor Model Facts',
    category: 'generic',
    blurb: 'Provenance, capabilities, and limits of a third-party model',
  },
  'threat-model': {
    label: 'Threat Model',
    category: 'generic',
    blurb: 'Security threat analysis (STRIDE-style) for the AI system',
  },
  'human-oversight-statement': {
    label: 'Human Oversight Statement',
    category: 'generic',
    blurb: 'Roles, controls, and intervention points for human review',
  },
  dpia: {
    label: 'DPIA',
    category: 'generic',
    blurb: 'Data Protection Impact Assessment (GDPR Art. 35)',
  },
  'model-card': {
    label: 'Model Card',
    category: 'generic',
    blurb: 'Standardized model documentation (intended use, metrics, caveats)',
  },
  'risk-memo': {
    label: 'Risk Memo',
    category: 'generic',
    blurb: 'Executive-level risk summary with mitigations',
  },
  'operational-readiness-plan': {
    label: 'Operational Readiness Plan',
    category: 'generic',
    blurb: 'Pre-launch readiness checklist and rollout plan',
  },
  'monitoring-plan': {
    label: 'Monitoring Plan',
    category: 'generic',
    blurb: 'KPIs, drift signals, and review cadence after launch',
  },
  'evidence-pack': {
    label: 'Evidence Pack',
    category: 'generic',
    blurb: 'Bundled evidence for audit / regulatory inquiry',
  },
  // ── GovSecure policies ────────────────────────────────────────────────────
  'govsecure-aup': {
    label: 'AI Acceptable Use Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed AUP for employees and contractors',
  },
  'govsecure-governance-policy': {
    label: 'AI Governance Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed governance charter and operating model',
  },
  'govsecure-data-privacy-policy': {
    label: 'AI Data Privacy Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed data handling, retention, and minimization',
  },
  'govsecure-risk-approval-policy': {
    label: 'AI Risk & Approval Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed tiered risk approval workflow',
  },
  'govsecure-security-policy': {
    label: 'AI Security Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed security controls and red-team requirements',
  },
  'govsecure-incident-response-policy': {
    label: 'AI Incident Response Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed AI incident classification and response',
  },
  'govsecure-human-oversight-policy': {
    label: 'AI Human Oversight Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed human-in-the-loop and override requirements',
  },
  'govsecure-vendor-policy': {
    label: 'AI Vendor & Third-Party Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed vendor due diligence and contract requirements',
  },
  'govsecure-third-party-policy': {
    label: 'AI Third-Party / Vendor Due Diligence Policy',
    category: 'govsecure-policy',
    blurb: 'GovSecure-licensed third-party AI risk tiering, due diligence, and off-boarding',
  },
  // ── GovSecure checklists ──────────────────────────────────────────────────
  'govsecure-checklist-intake': {
    label: 'Intake Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure intake gate verification list',
  },
  'govsecure-checklist-evidence-pack': {
    label: 'Evidence Pack Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure evidence pack completeness checklist',
  },
  'govsecure-checklist-incident-response': {
    label: 'Incident Response Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure incident response runbook checklist',
  },
  'govsecure-checklist-vendor-dd': {
    label: 'Vendor Due Diligence Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure vendor / third-party AI due diligence checklist',
  },
  'govsecure-checklist-shadow-ai': {
    label: 'Shadow AI Discovery Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure unsanctioned AI usage discovery checklist',
  },
  'govsecure-checklist-inventory': {
    label: 'AI Inventory Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure AI system inventory completeness checklist',
  },
  'govsecure-checklist-model-validation': {
    label: 'Model Validation Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure pre-deployment model validation checklist',
  },
  'govsecure-checklist-monitoring': {
    label: 'Monitoring Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure post-deployment monitoring checklist',
  },
  'govsecure-checklist-security': {
    label: 'AI Security Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure AI security controls checklist',
  },
  'govsecure-checklist-dpia': {
    label: 'DPIA Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure DPIA completeness checklist',
  },
  'govsecure-checklist-human-oversight': {
    label: 'Human Oversight Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure human-in-the-loop verification checklist',
  },
  'govsecure-checklist-change-management': {
    label: 'Change Management Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure model / system change management checklist',
  },
  'govsecure-checklist-training': {
    label: 'Training Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure AI literacy and role-based training checklist',
  },
  'govsecure-checklist-risk-assessment': {
    label: 'Risk Assessment Checklist',
    category: 'govsecure-checklist',
    blurb: 'GovSecure tiered risk assessment checklist',
  },
  // ── GovSecure flagship ────────────────────────────────────────────────────
  'govsecure-tprm': {
    label: 'TPRM Questionnaire',
    category: 'govsecure-flagship',
    blurb: 'GovSecure third-party risk management questionnaire',
  },
  'govsecure-nist-rcm': {
    label: 'NIST AI RMF Mapping',
    category: 'govsecure-flagship',
    blurb: 'GovSecure NIST AI RMF responsibility / control matrix',
  },
};

const CATEGORY_BADGE: Record<DocumentCategory, string> = {
  generic: 'bg-terminal-gray/40 text-terminal-muted border border-terminal-border',
  'govsecure-policy': 'bg-terminal-green/10 text-terminal-green border border-terminal-green/30',
  'govsecure-checklist': 'bg-terminal-cyan/10 text-terminal-cyan border border-terminal-cyan/30',
  'govsecure-flagship': 'bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/30',
};

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  generic: 'Generic',
  'govsecure-policy': 'GovSecure Policy',
  'govsecure-checklist': 'GovSecure Checklist',
  'govsecure-flagship': 'GovSecure Flagship',
};

export function getDocumentTypeMeta(type: string): DocumentTypeMeta {
  if (type in META) return META[type as DocumentType];
  return {
    label: type
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    category: 'generic',
    blurb: '',
  };
}

export function getCategoryBadgeClass(category: DocumentCategory): string {
  return CATEGORY_BADGE[category];
}

export function getCategoryLabel(category: DocumentCategory): string {
  return CATEGORY_LABEL[category];
}

export function isGovSecureType(type: string): boolean {
  return type.startsWith('govsecure-');
}
