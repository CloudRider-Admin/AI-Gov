/**
 * Document code generator — Phase 2.6.
 *
 * Produces deterministic codes in the GovSecure pattern:
 *
 *   `GS-{CATEGORY}-{TYPE}-{NUM:02d}-{shortHash}`
 *
 * Examples:
 *   `GS-AIPS-AUP-01-9f3a` — Acceptable Use Policy, instance hash 9f3a
 *   `GS-CHKL-INTAKE-09-7c11` — AI Use Case Intake Checklist
 *
 * The first three segments mirror the Phase-0 extractor's `documentCode`
 * scheme so generated artifacts are visually distinguishable from licensed
 * source templates only by the trailing instance hash.
 *
 * @see GOVI_GOVSECURE_INTEGRATION_PLAN.md — Phase 2.6.3 (Acceptance criterion 4)
 */

import { createHash } from 'crypto';

import type { DocumentType } from '@/types/documents';

/** Maps each DocumentType to its `{CATEGORY}-{TYPE}-{NUM}` prefix. */
const PREFIX_BY_TYPE: Record<DocumentType, string> = {
  // Generic governance docs — share a single category code.
  'use-case-summary': 'GENG-USECASE-01',
  'data-sheet': 'GENG-DATASHEET-02',
  'vendor-model-facts': 'GENG-VENDOR-03',
  'threat-model': 'GENG-THREAT-04',
  'human-oversight-statement': 'GENG-HUMOVER-05',
  'dpia': 'GENG-DPIA-06',
  'model-card': 'GENG-MODEL-07',
  'risk-memo': 'GENG-RISKMEMO-08',
  'operational-readiness-plan': 'GENG-OPSREAD-09',
  'monitoring-plan': 'GENG-MONITOR-10',
  'evidence-pack': 'GENG-EVIDENCE-11',
  // GovSecure policies — `AIPS` mirrors the source library prefix.
  'govsecure-aup': 'AIPS-AUP-01',
  'govsecure-governance-policy': 'AIPS-GOVERNAN-02',
  'govsecure-data-privacy-policy': 'AIPS-PRIVACY-03',
  'govsecure-risk-approval-policy': 'AIPS-RISKAPP-04',
  'govsecure-security-policy': 'AIPS-SECURITY-05',
  'govsecure-incident-response-policy': 'AIPS-INCIDENT-06',
  'govsecure-human-oversight-policy': 'AIPS-HUMOVER-07',
  'govsecure-vendor-policy': 'AIPS-VENDOR-08',
  // GovSecure checklists — `CHKL` mirrors the source library prefix.
  'govsecure-checklist-intake': 'CHKL-INTAKE-01',
  'govsecure-checklist-evidence-pack': 'CHKL-EVIDENCE-02',
  'govsecure-checklist-incident-response': 'CHKL-INCIDENT-03',
  'govsecure-checklist-vendor-dd': 'CHKL-VENDORDD-04',
  'govsecure-checklist-shadow-ai': 'CHKL-SHADOWAI-05',
  'govsecure-checklist-inventory': 'CHKL-INVENTRY-06',
  'govsecure-checklist-model-validation': 'CHKL-MODELVAL-07',
  'govsecure-checklist-monitoring': 'CHKL-MONITOR-08',
  'govsecure-checklist-security': 'CHKL-SECURITY-09',
  'govsecure-checklist-dpia': 'CHKL-DPIA-10',
  'govsecure-checklist-human-oversight': 'CHKL-HUMOVER-11',
  'govsecure-checklist-change-management': 'CHKL-CHANGE-12',
  'govsecure-checklist-training': 'CHKL-TRAINING-13',
  'govsecure-checklist-risk-assessment': 'CHKL-RISKASSE-14',
  // Phase 3 — flagship questionnaires + framework templates.
  'govsecure-tprm': 'QSTN-TPRM-01',
  'govsecure-nist-rcm': 'FRAM-NISTRCM-01',
};

export interface DocumentCodeInput {
  documentType: DocumentType;
  /** Owning user id — keeps the hash unique per organization. */
  userId?: string;
  /** Conversation context (when present) — disambiguates regenerations. */
  conversationId?: string;
  /** Use case / artifact title — disambiguates same-conversation reruns. */
  seed?: string;
}

/**
 * Build a document code. The trailing 4-character hash is deterministic from
 * the `userId + conversationId + seed` triple so re-running the same artifact
 * produces the same code (helpful for traceability).
 */
export function buildDocumentCode(input: DocumentCodeInput): string {
  const prefix = PREFIX_BY_TYPE[input.documentType] ?? 'GENG-UNKNOWN-99';
  const seedString = [input.userId ?? '', input.conversationId ?? '', input.seed ?? ''].join('|');
  const hash = createHash('sha256').update(seedString).digest('hex').slice(0, 4);
  return `GS-${prefix}-${hash}`;
}

/** Validate a code string against the canonical pattern. Used by tests. */
export const DOCUMENT_CODE_RE = /^GS-[A-Z]{4,5}-[A-Z]{3,8}-\d{2}-[0-9a-f]{4}$/;
