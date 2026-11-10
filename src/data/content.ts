// ─── Types ──────────────────────────────────────────────────────────────────

export interface Playbook {
  id: string;
  title: string;
  slug: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'leadership';
}

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface VisualGuide {
  id: string;
  title: string;
  description: string;
  type: string;
  image?: string;
}

export interface AudienceCard {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface ValueProp {
  id: string;
  title: string;
  description: string;
  highlights: string[];
}

export interface HeroContent {
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  supportText: string;
}

export interface TrustBadge {
  id: string;
  name: string;
  description: string;
}

export interface NavigationLevel {
  id: string;
  label: string;
  href: string;
}

export interface AdvisorContent {
  title: string;
  description: string;
  placeholder: string;
  cta: string;
}

// ─── Advisor Content ────────────────────────────────────────────────────────

export const advisorContent: AdvisorContent = {
  title: 'AI Governance Advisor',
  description:
    'Describe your AI use case and get an instant governance risk assessment with actionable recommendations aligned to NIST AI RMF, EU AI Act, and ISO 42001.',
  placeholder: 'Describe your AI use case, e.g. "We use an LLM to summarize customer support tickets and route them to the right team..."',
  cta: 'Analyze',
};

// ─── Hero Content ───────────────────────────────────────────────────────────

export const heroContent: HeroContent = {
  headline: 'Confident AI, Controlled Risk',
  subheadline:
    'GovSecure helps small businesses assess AI use cases, create practical policies, and reduce compliance risk — without enterprise complexity or outside consultants.',
  primaryCta: 'Get Started',
  secondaryCta: 'Browse Playbooks',
  supportText:
    'Aligned with NIST AI RMF, ISO/IEC 42001, and the EU AI Act. Built for teams that move fast but want to move safely.',
};

// ─── Trust Badges ───────────────────────────────────────────────────────────

export const trustBadges: TrustBadge[] = [
  {
    id: 'nist',
    name: 'NIST AI RMF',
    description: 'Risk Management Framework',
  },
  {
    id: 'iso',
    name: 'ISO/IEC 42001',
    description: 'AI Management System',
  },
  {
    id: 'eu-ai-act',
    name: 'EU AI Act',
    description: 'Regulation 2024/1689',
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    description: 'Data Protection',
  },
];

// ─── Navigation Levels ──────────────────────────────────────────────────────

export const navigationLevels: NavigationLevel[] = [
  { id: 'getting-started', label: 'Getting Started', href: '/learn/getting-started' },
  { id: 'scaling', label: 'Scaling', href: '/learn/scaling' },
  { id: 'advanced', label: 'Advanced', href: '/learn/advanced' },
];

// ─── Value Propositions ─────────────────────────────────────────────────────

export const valueProps: ValueProp[] = [
  {
    id: 'reduce-risk',
    title: 'Reduce AI Risk',
    description:
      'Identify and mitigate risks before they become costly incidents. Our framework maps your AI use cases against NIST, ISO, and EU AI Act requirements.',
    highlights: ['Risk assessment', 'Gap analysis', 'Mitigation plans'],
  },
  {
    id: 'protect-trust',
    title: 'Protect Customer Trust',
    description:
      'Demonstrate responsible AI practices to your customers, partners, and regulators. Build trust through transparency and accountability.',
    highlights: ['Transparency reports', 'Audit readiness', 'Stakeholder confidence'],
  },
  {
    id: 'scale-control',
    title: 'Scale With Control',
    description:
      'Grow your AI capabilities without losing control. Our governance framework scales with your organization from first use case to enterprise-wide deployment.',
    highlights: ['Phased rollout', 'Policy templates', 'Continuous monitoring'],
  },
];

// ─── Audience Cards ─────────────────────────────────────────────────────────

export const audienceCards: AudienceCard[] = [
  {
    id: 'founders-execs',
    title: 'Founders & Executives',
    description:
      'Understand your AI risk exposure and build governance that supports growth, not blocks it.',
    icon: 'Briefcase',
  },
  {
    id: 'cios-cisos',
    title: 'CROs & CIOs',
    description:
      'Integrate AI governance into your existing security and IT frameworks with minimal friction.',
    icon: 'Shield',
  },
  {
    id: 'data-ai-teams',
    title: 'Data & AI Teams',
    description:
      'Ship AI products faster with built-in guardrails, documentation templates, and compliance checks.',
    icon: 'Cpu',
  },
  {
    id: 'compliance-legal',
    title: 'Compliance & Legal',
    description:
      'Navigate the EU AI Act, NIST AI RMF, and ISO 42001 with practical guidance and ready-to-use policies.',
    icon: 'Scale',
  },
];

// ─── Visual Guides ──────────────────────────────────────────────────────────

export const visualGuides: VisualGuide[] = [
  {
    id: 'nist-rmf-overview',
    title: 'NIST AI RMF at a Glance',
    description:
      'A visual walkthrough of the four core functions — GOVERN, MAP, MEASURE, MANAGE — and how they fit together.',
    type: 'Infographic',
    image: '/infographicsforgovsecure/nist-rmf-blueprint.png',
  },
  {
    id: 'eu-ai-act-risk-pyramid',
    title: 'EU AI Act Risk Pyramid',
    description:
      'Understand the four risk tiers of the EU AI Act and where your AI systems fit.',
    type: 'Diagram',
    image: '/infographicsforgovsecure/eu-ai-act-framework.png',
  },
  {
    id: 'governance-maturity-model',
    title: 'AI Governance Maturity Model',
    description:
      'Assess where your organization stands and plan the path to mature, scalable AI governance.',
    type: 'Framework',
    image:
      'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=2400&q=80',
  },
];

// ─── Templates ──────────────────────────────────────────────────────────────

export const templates: Template[] = [
  {
    id: 'ai-acceptable-use-policy',
    title: 'AI Acceptable Use Policy',
    description: 'Define what AI tools employees can use and how, with clear guidelines and guardrails.',
    category: 'policy',
  },
  {
    id: 'ai-risk-assessment',
    title: 'AI Risk Assessment Template',
    description: 'Evaluate the risk level of any AI use case using a structured scoring methodology.',
    category: 'assessment',
  },
  {
    id: 'ai-vendor-evaluation',
    title: 'AI Vendor Evaluation Checklist',
    description: 'Assess third-party AI tools for security, compliance, and governance alignment.',
    category: 'checklist',
  },
  {
    id: 'ai-impact-assessment',
    title: 'AI Impact Assessment',
    description: 'Document the potential impacts of AI deployment on stakeholders and society.',
    category: 'assessment',
  },
  {
    id: 'ai-incident-response',
    title: 'AI Incident Response Plan',
    description: 'A step-by-step runbook for handling AI-related incidents and failures.',
    category: 'policy',
  },
  {
    id: 'data-governance-policy',
    title: 'Data Governance Policy for AI',
    description: 'Establish rules for data collection, storage, and use in AI model training and inference.',
    category: 'policy',
  },
];

// ─── Playbooks ──────────────────────────────────────────────────────────────

export const playbooks: Playbook[] = [
  {
    id: 'ai-chef-toolkit',
    slug: 'ai-chef-toolkit',
    title: 'GovSecure AI Chef™ Toolkit',
    description:
      'The flagship enterprise AI governance operating model — 6 stations and 24 core recipes covering intake, risk tiering, policy, vendor, monitoring, and incident response.',
    level: 'intermediate',
  },
  {
    id: '90-day-blueprint',
    slug: '90-day-blueprint',
    title: '90-Day AI Governance Implementation Blueprint',
    description:
      'A phased week-by-week rollout — Foundation, Implementation, and Operationalize — to stand up a working AI governance program in one quarter, mapped to NIST AI RMF and ISO 42001.',
    level: 'beginner',
  },
  {
    id: 'ai-chef-executive',
    slug: 'ai-chef-executive',
    title: 'AI Chef Executive Toolkit',
    description:
      'Board- and executive-level summary of the AI Chef operating model — governance posture, risk exposure, and quarterly review materials in a deck-ready format.',
    level: 'leadership',
  },
  {
    id: 'ai-chef-operational',
    slug: 'ai-chef-operational',
    title: 'AI Chef Operational Templates',
    description:
      'The companion workbook of ready-to-fill operational templates — intake forms, RACI matrices, risk tiering worksheets, evidence registers, and policy-to-control crosswalks.',
    level: 'intermediate',
  },
  {
    id: 'third-party-privacy',
    slug: 'third-party-privacy',
    title: 'Third-Party AI Privacy Risk Assessment',
    description:
      'A nine-section vendor questionnaire and scoring workbook for assessing third-party AI providers across privacy, data handling, security, and subprocessor risk.',
    level: 'intermediate',
  },
  {
    id: 'ai-chef-infographic',
    slug: 'ai-chef-infographic',
    title: 'AI Chef Visual Overview',
    description:
      'An at-a-glance infographic of the AI Chef operating model — the fastest way to align stakeholders on stations, recipes, and governance flow.',
    level: 'beginner',
  },
];

// ─── AI Governance Life Cycle Templates (models & use cases) ────────────────

export interface LifecycleTemplate {
  id: string;
  title: string;
  description: string;
  href: string;
}

export const lifecycleTemplates: LifecycleTemplate[] = [
  {
    id: 'ai-inventory',
    title: 'AI Inventory Templates',
    description:
      'Build and maintain an audit-ready registry of every AI system, model, tool, and use case — with owners, risk tiers, and lifecycle status.',
    href: '/playbooks',
  },
  {
    id: 'ai-use-case-form',
    title: 'AI Use Case Form',
    description:
      'A standard intake form to capture, triage, and route proposed or materially changed AI use cases before review and approval.',
    href: '/playbooks',
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment Templates',
    description:
      'Stakeholder-input templates that assess each AI use case for potential harm, data sensitivity, and auto-high triggers ahead of governance sign-off.',
    href: '/playbooks',
  },
  {
    id: 'risk-tiering',
    title: 'Risk Tiering',
    description:
      'Classify AI use cases into Low, Medium, High, and Critical tiers to calibrate the controls, oversight, and approvals each one requires.',
    href: '/playbooks',
  },
  {
    id: 'ai-approval',
    title: 'AI Approval Template',
    description:
      'Record the formal go / conditional-go / no-go decision, required approvers, and launch conditions for each AI use case.',
    href: '/playbooks',
  },
];