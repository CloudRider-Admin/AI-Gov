/**
 * Curated control catalogs for the compliance posture surface (Tier 1b).
 *
 * These are representative subsets — enough to give SMBs a meaningful,
 * actionable posture view without overwhelming them. They are static reference
 * data (no DB table); user progress is stored per-control in `ControlAssessment`.
 */

export interface Control {
  id: string;        // stable within a framework, e.g. "GOVERN-1.1"
  title: string;
  category: string;  // grouping within the framework
  description: string;
}

export interface Framework {
  id: string;        // "NIST-AI-RMF" | "ISO-42001" | "EU-AI-Act"
  name: string;
  authority: string;
  controls: Control[];
}

export const FRAMEWORKS: Framework[] = [
  {
    id: 'NIST-AI-RMF',
    name: 'NIST AI Risk Management Framework',
    authority: 'NIST (US)',
    controls: [
      { id: 'GOVERN-1.1', title: 'Legal & regulatory requirements understood', category: 'Govern', description: 'Legal and regulatory requirements involving AI are understood, managed, and documented.' },
      { id: 'GOVERN-2.1', title: 'Roles & responsibilities defined', category: 'Govern', description: 'Roles, responsibilities, and lines of communication for AI risk are documented and clear.' },
      { id: 'GOVERN-4.1', title: 'Risk culture & accountability', category: 'Govern', description: 'Organizational practices are in place to foster critical thinking and a safety-first mindset.' },
      { id: 'MAP-1.1', title: 'Context & intended purpose', category: 'Map', description: 'Intended purpose, setting, and expected use of the AI system are documented.' },
      { id: 'MAP-2.3', title: 'System capabilities & limitations', category: 'Map', description: 'Scientific integrity and TEVV (test, evaluation, verification, validation) considerations are mapped.' },
      { id: 'MEASURE-2.1', title: 'Evaluation for trustworthiness', category: 'Measure', description: 'Appropriate methods and metrics are identified and applied to evaluate AI risks.' },
      { id: 'MEASURE-2.7', title: 'Security & resilience assessed', category: 'Measure', description: 'AI system security and resilience are evaluated and documented.' },
      { id: 'MANAGE-1.1', title: 'Risk response prioritized', category: 'Manage', description: 'Determination is made on whether the AI system achieves its intended purpose and risks are prioritized.' },
      { id: 'MANAGE-2.2', title: 'Ongoing monitoring mechanisms', category: 'Manage', description: 'Mechanisms are in place to sustain the value of deployed AI and to monitor for risks.' },
      { id: 'MANAGE-4.1', title: 'Post-deployment monitoring & incident response', category: 'Manage', description: 'Post-deployment monitoring plans are implemented, including incident response and recovery.' },
    ],
  },
  {
    id: 'ISO-42001',
    name: 'ISO/IEC 42001 AI Management System',
    authority: 'ISO/IEC',
    controls: [
      { id: 'A.2.2', title: 'AI policy', category: 'Policies', description: 'An AI policy is established, documented, and communicated across the organization.' },
      { id: 'A.3.2', title: 'AI roles & responsibilities', category: 'Organization', description: 'AI-related roles and responsibilities are defined and allocated.' },
      { id: 'A.4.2', title: 'Resources for AI systems', category: 'Resources', description: 'Resources (data, tooling, people, compute) for AI systems are identified and documented.' },
      { id: 'A.5.2', title: 'AI impact assessment process', category: 'Impact', description: 'A process to assess AI system impacts on individuals and society is defined and applied.' },
      { id: 'A.6.2', title: 'AI system lifecycle management', category: 'Lifecycle', description: 'Requirements for responsible design and development across the lifecycle are documented.' },
      { id: 'A.7.2', title: 'Data quality & governance', category: 'Data', description: 'Data used for AI systems is managed for quality, provenance, and governance.' },
      { id: 'A.8.2', title: 'Information for interested parties', category: 'Transparency', description: 'Information about AI systems is available to relevant interested parties.' },
      { id: 'A.9.2', title: 'Responsible use of AI', category: 'Use', description: 'Objectives and controls for the responsible use of AI systems are established.' },
      { id: 'A.10.2', title: 'Third-party & supplier controls', category: 'Third parties', description: 'Responsibilities are allocated for AI systems provided by or to third parties.' },
    ],
  },
  {
    id: 'EU-AI-Act',
    name: 'EU AI Act',
    authority: 'European Union',
    controls: [
      { id: 'ART-9', title: 'Risk management system', category: 'High-risk obligations', description: 'A risk management system is established, implemented, and maintained for high-risk AI systems.' },
      { id: 'ART-10', title: 'Data & data governance', category: 'High-risk obligations', description: 'Training, validation, and testing data meet quality criteria and governance practices.' },
      { id: 'ART-11', title: 'Technical documentation', category: 'High-risk obligations', description: 'Technical documentation is drawn up before the system is placed on the market and kept up to date.' },
      { id: 'ART-12', title: 'Record-keeping / logging', category: 'High-risk obligations', description: 'High-risk AI systems automatically record events (logs) over their lifetime.' },
      { id: 'ART-13', title: 'Transparency & user information', category: 'High-risk obligations', description: 'Operation is sufficiently transparent to enable deployers to interpret output and use it appropriately.' },
      { id: 'ART-14', title: 'Human oversight', category: 'High-risk obligations', description: 'High-risk AI systems are designed to be effectively overseen by natural persons.' },
      { id: 'ART-15', title: 'Accuracy, robustness & cybersecurity', category: 'High-risk obligations', description: 'Systems achieve appropriate accuracy, robustness, and cybersecurity throughout their lifecycle.' },
      { id: 'ART-50', title: 'Transparency for certain AI systems', category: 'Transparency', description: 'Users are informed when interacting with AI (chatbots) and of AI-generated content (deepfakes).' },
      { id: 'ART-52', title: 'GPAI transparency obligations', category: 'General-purpose AI', description: 'Providers of general-purpose AI models meet documentation and transparency obligations.' },
    ],
  },
];

export function getFramework(id: string): Framework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

export const FRAMEWORK_IDS = FRAMEWORKS.map((f) => f.id);
