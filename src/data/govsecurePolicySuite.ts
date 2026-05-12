/**
 * GovSecure Policy Suite Map — typed registry of the 15 enterprise AI
 * policies catalogued in `GovSecure_AI_Policy_Suite_Map_Client_Ready.docx`,
 * grouped into Tier 1 (Core Starter), Tier 2 (Operational Control), and
 * Tier 3 (Maturity / Assurance) bundles.
 *
 * Why this exists: the IntakeOrchestrator and advisor were inventing
 * generic suggested-policy titles ("Data Privacy and Security Policy",
 * "AI System Monitoring and Evaluation Policy") instead of recommending
 * the actual GovSecure policy names that the client will receive in their
 * licensed delivery. This module is the bridge.
 *
 * @see /workspaces/AI-Gov/src/data/govsecureContent/policies/suite-map.json
 * @see GovSecure_AI_Policy_Suite_Map_Client_Ready.docx
 */

import { DOCUMENT_TYPE_VALUES } from '@/lib/ai/schemas';

type DocumentTypeValue = (typeof DOCUMENT_TYPE_VALUES)[number];

export type PolicyTier = 1 | 2 | 3;

export interface GovSecurePolicy {
  /** Canonical title as it appears in the Suite Map. */
  title: string;
  /** Short purpose snapshot (one line). */
  purpose: string;
  /** Primary owner role for client implementation. */
  primaryOwner: string;
  /** Audience the policy applies to. */
  audience: string;
  /** Suite-Map tier — 1 = Core Starter, 2 = Operational, 3 = Maturity. */
  tier: PolicyTier;
  /** Document type id when a corresponding generated artifact exists. */
  documentType?: DocumentTypeValue;
  /** Loose category for the advisor `policyRecommendation` shape. */
  category: 'governance' | 'data' | 'security' | 'compliance' | 'ethics' | 'operations';
}

export const GOVSECURE_POLICY_SUITE: GovSecurePolicy[] = [
  // ── Tier 1 — Core Starter Set (6 policies) ──
  {
    title: 'Enterprise AI Acceptable Use Policy',
    purpose: 'Rules for day-to-day employee use of AI tools and outputs.',
    primaryOwner: 'AI Governance Lead with Security and Legal support',
    audience: 'Enterprise workforce and approved users',
    tier: 1,
    documentType: 'govsecure-aup',
    category: 'governance',
  },
  {
    title: 'AI Governance Policy',
    purpose: 'Defines ownership, oversight, escalation, and decision rights.',
    primaryOwner: 'Executive Sponsor / AI Governance Lead',
    audience: 'Leaders and control functions',
    tier: 1,
    documentType: 'govsecure-governance-policy',
    category: 'governance',
  },
  {
    title: 'AI Data Handling and Privacy Policy',
    purpose: 'Defines how AI-related data is classified, used, retained, and protected.',
    primaryOwner: 'Privacy Lead / Data Protection Lead with Security and Data Governance support',
    audience: 'AI users and data/control owners',
    tier: 1,
    documentType: 'govsecure-data-privacy-policy',
    category: 'data',
  },
  {
    title: 'AI Risk Assessment and Use-Case Approval Policy',
    purpose: 'Requires AI use cases to be reviewed before adoption or material change.',
    primaryOwner: 'AI Governance Lead with Risk, Legal, Privacy, and Security review support',
    audience: 'Sponsors, requestors, and reviewers',
    tier: 1,
    documentType: 'govsecure-risk-approval-policy',
    category: 'governance',
  },
  {
    title: 'Third-Party / Vendor AI Due Diligence Policy',
    purpose: 'Sets requirements for evaluating AI vendors and service providers.',
    primaryOwner: 'Procurement / Vendor Risk Lead with Security, Privacy, and Legal support',
    audience: 'Procurement and review teams',
    tier: 1,
    documentType: 'govsecure-vendor-policy',
    category: 'compliance',
  },
  {
    title: 'AI Security Policy',
    purpose: 'Defines technical and operational security requirements for AI systems.',
    primaryOwner: 'Information Security Lead',
    audience: 'Security, IT, engineering',
    tier: 1,
    documentType: 'govsecure-security-policy',
    category: 'security',
  },

  // ── Tier 2 — Operational Control Set (4 policies) ──
  {
    title: 'Human Oversight and Decision-Making Policy',
    purpose: 'Defines where humans must review or override AI-assisted actions.',
    primaryOwner: 'AI Governance Lead with Legal and business owner support',
    audience: 'Decision-makers and reviewers',
    tier: 2,
    documentType: 'govsecure-human-oversight-policy',
    category: 'governance',
  },
  {
    title: 'AI Transparency and Disclosure Policy',
    purpose: 'Explains when AI use and AI-generated content must be disclosed.',
    primaryOwner: 'Legal / Compliance with Communications and AI Governance support',
    audience: 'Legal, communications, product',
    tier: 2,
    category: 'compliance',
  },
  {
    title: 'AI Incident Response Policy',
    purpose: 'Defines how the organization handles AI-related incidents and harms.',
    primaryOwner: 'Information Security Lead with Privacy, Legal, IT, and business owner support',
    audience: 'Incident responders and leaders',
    tier: 2,
    documentType: 'govsecure-incident-response-policy',
    category: 'security',
  },
  {
    title: 'AI Monitoring, Logging, and Change Management Policy',
    purpose: 'Requires monitoring, drift review, and approval of material AI changes.',
    primaryOwner: 'IT / Platform Owner with Security and AI Governance oversight',
    audience: 'IT, platform, governance',
    tier: 2,
    category: 'operations',
  },

  // ── Tier 3 — Maturity / Assurance Set (5 policies) ──
  {
    title: 'AI Inventory and Registry Policy',
    purpose: 'Requires all enterprise AI systems and use cases to be inventoried.',
    primaryOwner: 'AI Governance Lead with IT support',
    audience: 'Business, IT, audit, control teams',
    tier: 3,
    category: 'governance',
  },
  {
    title: 'AI Model Lifecycle / Development Policy',
    purpose: 'Applies when the enterprise builds, fine-tunes, or materially customizes models.',
    primaryOwner: 'Engineering / Product Owner with Security and Governance oversight',
    audience: 'Engineering and model owners',
    tier: 3,
    category: 'operations',
  },
  {
    title: 'Responsible AI / Ethics Policy',
    purpose: 'Defines fairness, accountability, transparency, and non-discrimination principles.',
    primaryOwner: 'Executive Sponsor / AI Governance Lead with Legal and HR support',
    audience: 'Executives and sensitive-use stakeholders',
    tier: 3,
    category: 'ethics',
  },
  {
    title: 'AI Training and Awareness Policy',
    purpose: 'Requires role-based training and awareness for AI users and overseers.',
    primaryOwner: 'AI Governance Lead with HR and Security Awareness support',
    audience: 'Entire workforce by role',
    tier: 3,
    category: 'governance',
  },
  {
    title: 'AI Records Retention and Evidence Policy',
    purpose: 'Defines what governance and control evidence must be retained.',
    primaryOwner: 'Records Management / Compliance Lead with Privacy, Legal, and Governance support',
    audience: 'Compliance, audit, governance',
    tier: 3,
    category: 'compliance',
  },
];

export interface PolicySuggestionContext {
  /** Whether the user already has a documented framework. */
  hasExistingFramework?: boolean;
  /** Risk tier from the intake assessment. */
  riskTier?: 'Low' | 'Medium' | 'High' | 'Critical';
  /** Public/customer-facing flag. */
  customerFacing?: boolean;
  /** Whether sensitive/regulated data is in scope. */
  handlesSensitiveData?: boolean;
  /** Industry hint. */
  industry?: string;
}

/**
 * Recommend the GovSecure policy bundle for a use case. Defaults to the
 * Tier 1 Core Starter when no existing framework is in place. Adds Tier 2
 * policies for High-risk or customer-facing scenarios. Adds the Vendor /
 * Third-Party policy explicitly when third-party data sources are in play.
 */
export function recommendPolicies(ctx: PolicySuggestionContext): GovSecurePolicy[] {
  const out = new Map<string, GovSecurePolicy>();

  // Always include Tier 1 when no framework exists.
  if (!ctx.hasExistingFramework) {
    for (const p of GOVSECURE_POLICY_SUITE.filter(p => p.tier === 1)) {
      out.set(p.title, p);
    }
  }

  // Add Tier 2 for High/Critical or customer/public-facing.
  if (ctx.riskTier === 'High' || ctx.riskTier === 'Critical' || ctx.customerFacing) {
    for (const p of GOVSECURE_POLICY_SUITE.filter(p => p.tier === 2)) {
      out.set(p.title, p);
    }
  }

  // Sensitive data → ensure Data Handling and Vendor policies are included
  // even if Tier 1 was skipped (e.g., framework already exists).
  if (ctx.handlesSensitiveData) {
    for (const p of GOVSECURE_POLICY_SUITE.filter(p =>
      p.title === 'AI Data Handling and Privacy Policy' ||
      p.title === 'Third-Party / Vendor AI Due Diligence Policy',
    )) {
      out.set(p.title, p);
    }
  }

  return Array.from(out.values()).sort((a, b) => a.tier - b.tier);
}

/** Return only the Tier 1 starter set (6 policies). */
export function tier1Starter(): GovSecurePolicy[] {
  return GOVSECURE_POLICY_SUITE.filter(p => p.tier === 1);
}

/**
 * Map a `GovSecurePolicy` to the advisor `policyRecommendationSchema` shape.
 * Tier 1 policies map to "high" priority (foundational), Tier 2 to "medium",
 * Tier 3 to "low".
 */
export function toPolicyRecommendation(p: GovSecurePolicy): {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  documentType?: DocumentTypeValue;
} {
  const priority: 'high' | 'medium' | 'low' = p.tier === 1 ? 'high' : p.tier === 2 ? 'medium' : 'low';
  return {
    title: p.title,
    description: p.purpose,
    priority,
    category: p.category,
    documentType: p.documentType,
  };
}
