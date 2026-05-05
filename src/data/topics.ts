// Topic/Category Map for Content Strategy
// CMS-ready structure for future headless CMS integration

export interface Topic {
  id: string;
  title: string;
  slug: string;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  topics: Topic[];
}

export const categories: Category[] = [
  {
    id: "strategy",
    name: "Strategy",
    slug: "strategy",
    description: "High-level AI governance planning and organizational alignment",
    icon: "Target",
    topics: [
      {
        id: "governance-charter",
        title: "How to Build an AI Governance Charter",
        slug: "build-ai-governance-charter",
        description: "Create the foundational document for your AI governance program",
      },
      {
        id: "executive-buy-in",
        title: "Getting Executive Buy-In for AI Governance",
        slug: "executive-buy-in-ai-governance",
        description: "Strategies for securing leadership support",
      },
      {
        id: "governance-roadmap",
        title: "Building Your AI Governance Roadmap",
        slug: "ai-governance-roadmap",
        description: "Step-by-step planning for governance implementation",
      },
    ],
  },
  {
    id: "risk-compliance",
    name: "Risk & Compliance",
    slug: "risk-compliance",
    description: "Regulatory alignment and risk management frameworks",
    icon: "AlertTriangle",
    topics: [
      {
        id: "regulatory-mapping",
        title: "Mapping AI Use Cases to Regulatory Risk",
        slug: "mapping-ai-regulatory-risk",
        description: "Connect your AI implementations to compliance requirements",
      },
      {
        id: "eu-ai-act-guide",
        title: "EU AI Act Compliance Guide for SMBs",
        slug: "eu-ai-act-compliance-guide",
        description: "Navigate the EU AI Act requirements",
      },
      {
        id: "nist-ai-rmf",
        title: "Implementing NIST AI RMF",
        slug: "implementing-nist-ai-rmf",
        description: "Practical guide to the NIST AI Risk Management Framework",
      },
    ],
  },
  {
    id: "security",
    name: "Security",
    slug: "security",
    description: "AI-specific security threats and protections",
    icon: "Shield",
    topics: [
      {
        id: "prompt-injection",
        title: "Prompt Injection & Model Abuse",
        slug: "prompt-injection-model-abuse",
        description: "Understanding and preventing prompt-based attacks",
      },
      {
        id: "data-poisoning",
        title: "Data Poisoning Prevention",
        slug: "data-poisoning-prevention",
        description: "Protecting training data integrity",
      },
      {
        id: "model-theft",
        title: "Model Theft and IP Protection",
        slug: "model-theft-ip-protection",
        description: "Safeguarding your AI intellectual property",
      },
    ],
  },
  {
    id: "ethics",
    name: "Ethics",
    slug: "ethics",
    description: "Responsible AI principles and ethical frameworks",
    icon: "Heart",
    topics: [
      {
        id: "usage-guidelines",
        title: "Designing AI Usage Guidelines",
        slug: "designing-ai-usage-guidelines",
        description: "Create ethical boundaries for AI use",
      },
      {
        id: "bias-fairness",
        title: "Bias Detection and Fairness Testing",
        slug: "bias-detection-fairness-testing",
        description: "Ensure equitable AI outcomes",
      },
      {
        id: "transparency",
        title: "AI Transparency and Explainability",
        slug: "ai-transparency-explainability",
        description: "Making AI decisions understandable",
      },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    slug: "operations",
    description: "Day-to-day AI governance processes and monitoring",
    icon: "Settings",
    topics: [
      {
        id: "continuous-monitoring",
        title: "Continuous AI Risk Monitoring",
        slug: "continuous-ai-risk-monitoring",
        description: "Ongoing oversight and alerting systems",
      },
      {
        id: "incident-response",
        title: "AI Incident Response Planning",
        slug: "ai-incident-response-planning",
        description: "Prepare for and respond to AI failures",
      },
      {
        id: "model-lifecycle",
        title: "Model Lifecycle Management",
        slug: "model-lifecycle-management",
        description: "From development to retirement",
      },
    ],
  },
];

// Helper function to get all topics flat
export function getAllTopics(): Topic[] {
  return categories.flatMap((category) => category.topics);
}

// Helper function to get category by slug
export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

// Helper function to get topic by slug
export function getTopicBySlug(slug: string): Topic | undefined {
  return getAllTopics().find((topic) => topic.slug === slug);
}
