export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: 'framework' | 'regulation' | 'best-practice' | 'template' | 'case-study';
  tags: string[];
  source: string;
  lastUpdated: string;
  relevanceScore?: number;
}

export interface SearchResult {
  documents: KnowledgeDocument[];
  totalResults: number;
  searchTime: number;
}

// AI Governance Knowledge Base
import { SECTOR_GUIDANCE } from '@/data/sectorGuidance';
import { EMERGING_REGULATIONS } from '@/data/emergingRegulations';

// Generate KnowledgeDocuments from sector guidance
const SECTOR_DOCUMENTS: KnowledgeDocument[] = SECTOR_GUIDANCE.map(sector => ({
  id: `sector-${sector.id}`,
  title: `AI Governance for ${sector.displayName}`,
  content: `${sector.description}\n\nKey Regulations:\n${sector.keyRegulations.map(r => `- ${r.name}: ${r.relevance}`).join('\n')}\n\nRisk Factors:\n${sector.riskFactors.map(r => `- ${r.factor} (${r.severity}): ${r.description}`).join('\n')}\n\nRecommendations:\n${sector.recommendations.map(r => `- ${r}`).join('\n')}\n\nFramework Priorities:\n${sector.frameworkPriorities.map(f => `- ${f.framework}: ${f.focus}`).join('\n')}`,
  category: 'best-practice' as const,
  tags: [sector.sector, ...sector.keyRegulations.map(r => r.name.split(' ')[0]), 'sector-guidance'],
  source: `GovSecure Sector Guidance — ${sector.displayName}`,
  lastUpdated: '2026-03-27',
}));

// Generate KnowledgeDocuments from emerging regulations
const REGULATION_DOCUMENTS: KnowledgeDocument[] = EMERGING_REGULATIONS.map(reg => ({
  id: `regulation-${reg.id}`,
  title: `${reg.shortName} — ${reg.jurisdiction}`,
  content: `${reg.summary}\n\nStatus: ${reg.status}${reg.effectiveDate ? ` (Effective: ${reg.effectiveDate})` : ''}\n\nKey Provisions:\n${reg.keyProvisions.map(p => `- ${p.provision}: ${p.description}`).join('\n')}\n\nCompliance Actions:\n${reg.complianceActions.map(a => `- ${a}`).join('\n')}${reg.penaltyRange ? `\n\nPenalties: ${reg.penaltyRange}` : ''}`,
  category: 'regulation' as const,
  tags: [reg.shortName, reg.jurisdiction, ...reg.affectedSectors.slice(0, 4), 'emerging-regulation'],
  source: reg.name,
  lastUpdated: '2026-03-27',
}));

export const GOVERNANCE_KNOWLEDGE_BASE: KnowledgeDocument[] = [
  {
    id: 'nist-ai-rmf-overview',
    title: 'NIST AI Risk Management Framework Overview',
    content: `The NIST AI Risk Management Framework (AI RMF 1.0) provides a comprehensive approach to managing AI risks. Key components include:

GOVERN: Establish governance templates or checklists, structures, policies, and oversight mechanisms for AI systems.
MAP: Identify and categorize AI risks across the system lifecycle.
MEASURE: Develop metrics and assessment methods for AI system performance and risks.
MANAGE: Implement risk mitigation strategies and response plans.

Core principles:
- Human-centered design and operation
- Fairness and non-discrimination
- Transparency and explainability
- Accountability and responsibility
- Reliability and safety
- Privacy protection

Implementation for SMBs:
1. Start with governance structure (AI oversight committee)
2. Conduct initial risk mapping for existing AI systems
3. Establish basic measurement and monitoring
4. Develop incident response procedures
5. Regular review and updates`,
    category: 'framework',
    tags: ['NIST', 'risk management', 'framework', 'governance'],
    source: 'NIST AI RMF 1.0',
    lastUpdated: '2024-01-15'
  },
  {
    id: 'eu-ai-act-compliance',
    title: 'EU AI Act Compliance Requirements',
    content: `The EU AI Act establishes risk-based regulations for AI systems:

PROHIBITED AI SYSTEMS:
- Social scoring by governments
- Real-time biometric identification in public spaces
- AI systems exploiting vulnerabilities

HIGH-RISK AI SYSTEMS:
- Safety components in regulated products
- Biometric identification systems
- Critical infrastructure management
- Educational/vocational training systems
- Employment and worker management
- Essential private/public services
- Law enforcement systems
- Migration/asylum/border control
- Administration of justice

LIMITED RISK AI SYSTEMS:
- Chatbots and AI systems interacting with humans
- Emotion recognition systems
- Biometric categorization systems
- AI-generated content (deepfakes)

MINIMAL RISK AI SYSTEMS:
- Most other AI applications

Compliance requirements vary by risk category, with high-risk systems requiring:
- Risk management systems
- Data governance measures
- Technical documentation
- Record-keeping obligations
- Transparency and user information
- Human oversight measures
- Accuracy, robustness, and cybersecurity`,
    category: 'regulation',
    tags: ['EU AI Act', 'compliance', 'risk categories', 'requirements'],
    source: 'EU AI Act Official Text',
    lastUpdated: '2024-01-10'
  },
  {
    id: 'gdpr-ai-considerations',
    title: 'GDPR Considerations for AI Systems',
    content: `Key GDPR requirements for AI systems processing personal data:

LAWFUL BASIS (Article 6):
- Consent, contract, legal obligation, vital interests, public task, or legitimate interests
- AI systems must have clear lawful basis for processing

AUTOMATED DECISION-MAKING (Article 22):
- Individuals have right not to be subject to solely automated decision-making
- Exceptions: necessary for contract, authorized by law, or based on explicit consent
- Must implement suitable measures to safeguard rights (human intervention, contest decision)

DATA PROTECTION BY DESIGN AND BY DEFAULT (Article 25):
- Implement appropriate technical and organizational measures
- Consider data minimization, purpose limitation, storage limitation
- Privacy-enhancing technologies (PETs) recommended

DATA PROTECTION IMPACT ASSESSMENT (Article 35):
- Required for high-risk processing (likely includes most AI systems)
- Must assess risks to rights and freedoms
- Consult supervisory authority if high residual risk

TRANSPARENCY AND INFORMATION (Articles 13-14):
- Inform individuals about automated decision-making
- Explain logic, significance, and consequences
- Provide meaningful information about processing

RIGHTS OF DATA SUBJECTS:
- Right of access (Article 15)
- Right to rectification (Article 16)
- Right to erasure (Article 17)
- Right to restrict processing (Article 18)
- Right to data portability (Article 20)
- Right to object (Article 21)`,
    category: 'regulation',
    tags: ['GDPR', 'data protection', 'automated decision-making', 'privacy'],
    source: 'GDPR Official Text',
    lastUpdated: '2024-01-05'
  },
  {
    id: 'iso-42001-implementation',
    title: 'ISO/IEC 42001 AI Management System Implementation',
    content: `ISO/IEC 42001 provides requirements for establishing, implementing, maintaining and continually improving an AI management system (AIMS).

KEY REQUIREMENTS:

CONTEXT OF THE ORGANIZATION (Clause 4):
- Understand internal/external issues affecting AI objectives
- Identify interested parties and their requirements
- Determine scope of AIMS

LEADERSHIP (Clause 5):
- Top management commitment and leadership
- Establish AI policy aligned with strategic direction
- Assign roles, responsibilities, and authorities

PLANNING (Clause 6):
- Address risks and opportunities
- Establish AI objectives and plans to achieve them
- Plan for changes to AIMS

SUPPORT (Clause 7):
- Determine and provide necessary resources
- Ensure competence of personnel
- Raise awareness of AI policy and objectives
- Establish communication processes
- Control documented information

OPERATION (Clause 8):
- Plan, implement and control AI system processes
- Manage AI system lifecycle
- Control externally provided AI systems
- Monitor and measure AI system performance

PERFORMANCE EVALUATION (Clause 9):
- Monitor, measure, analyze and evaluate AIMS
- Conduct internal audits
- Management review of AIMS

IMPROVEMENT (Clause 10):
- Address nonconformities and corrective actions
- Continual improvement of AIMS

Implementation roadmap for SMBs:
1. Gap analysis against current practices
2. Develop AI policy and objectives
3. Establish governance structure
4. Implement risk management processes
5. Create documentation and procedures
6. Train personnel and raise awareness
7. Monitor and measure performance
8. Conduct internal audits
9. Management review and improvement`,
    category: 'framework',
    tags: ['ISO 42001', 'management system', 'implementation', 'certification'],
    source: 'ISO/IEC 42001:2023',
    lastUpdated: '2023-12-20'
  },
  {
    id: 'ai-risk-assessment-template',
    title: 'AI Risk Assessment Template and Methodology',
    content: `Comprehensive AI risk assessment methodology for SMBs:

RISK IDENTIFICATION:
1. Technical Risks:
   - Model bias and fairness
   - Accuracy and performance degradation
   - Adversarial attacks and security vulnerabilities
   - Data quality and integrity issues
   - System reliability and availability

2. Operational Risks:
   - Human oversight and intervention capabilities
   - Change management and version control
   - Incident response and recovery procedures
   - Vendor and third-party dependencies
   - Skills and competency gaps

3. Regulatory and Compliance Risks:
   - Data protection violations (GDPR, CCPA)
   - AI-specific regulations (EU AI Act)
   - Industry-specific requirements
   - Cross-border data transfer restrictions
   - Audit and documentation requirements

4. Business and Reputational Risks:
   - Customer trust and satisfaction
   - Brand reputation and public perception
   - Competitive disadvantage
   - Financial losses and liability
   - Stakeholder confidence

RISK ASSESSMENT MATRIX:
Likelihood: Very Low (1) | Low (2) | Medium (3) | High (4) | Very High (5)
Impact: Negligible (1) | Minor (2) | Moderate (3) | Major (4) | Severe (5)
Risk Score = Likelihood × Impact

RISK CATEGORIES:
- Low Risk (1-6): Accept with monitoring
- Medium Risk (7-12): Mitigate with controls
- High Risk (13-20): Immediate action required
- Critical Risk (21-25): Stop/redesign system

MITIGATION STRATEGIES:
- Avoid: Eliminate the risk source
- Reduce: Implement controls to lower likelihood/impact
- Transfer: Insurance, contracts, outsourcing
- Accept: Monitor and prepare contingency plans

DOCUMENTATION REQUIREMENTS:
- Risk register with identified risks
- Assessment methodology and criteria
- Mitigation plans and controls
- Monitoring and review procedures
- Incident response plans
- Regular risk review reports`,
    category: 'template',
    tags: ['risk assessment', 'methodology', 'template', 'SMB'],
    source: 'AI Governance Best Practices',
    lastUpdated: '2024-01-12'
  }
];

/** All knowledge documents: static governance + sector guidance + emerging regulations */
export const ALL_KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  ...GOVERNANCE_KNOWLEDGE_BASE,
  ...SECTOR_DOCUMENTS,
  ...REGULATION_DOCUMENTS,
];

export class KnowledgeBaseSearch {
  private documents: KnowledgeDocument[];

  constructor(documents: KnowledgeDocument[] = ALL_KNOWLEDGE_DOCUMENTS) {
    this.documents = documents;
  }

  search(query: string, category?: string, limit: number = 5): SearchResult {
    const startTime = Date.now();
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);

    let results = this.documents.map(doc => {
      let score = 0;

      // Title matching (higher weight)
      const titleMatches = queryTerms.filter(term => 
        doc.title.toLowerCase().includes(term)
      ).length;
      score += titleMatches * 3;

      // Content matching
      const contentMatches = queryTerms.filter(term => 
        doc.content.toLowerCase().includes(term)
      ).length;
      score += contentMatches * 1;

      // Tag matching (medium weight)
      const tagMatches = queryTerms.filter(term => 
        doc.tags.some(tag => tag.toLowerCase().includes(term))
      ).length;
      score += tagMatches * 2;

      // Category matching
      if (category && doc.category === category) {
        score += 2;
      }

      return { ...doc, relevanceScore: score };
    });

    // Filter by relevance and category
    results = results.filter(doc => {
      if (doc.relevanceScore === 0) return false;
      if (category && doc.category !== category) return false;
      return true;
    });

    // Sort by relevance score
    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Limit results
    const limitedResults = results.slice(0, limit);

    const searchTime = Date.now() - startTime;

    return {
      documents: limitedResults,
      totalResults: results.length,
      searchTime
    };
  }

  getByCategory(category: string): KnowledgeDocument[] {
    return this.documents.filter(doc => doc.category === category);
  }

  getByTags(tags: string[]): KnowledgeDocument[] {
    return this.documents.filter(doc => 
      tags.some(tag => doc.tags.includes(tag))
    );
  }

  addDocument(document: KnowledgeDocument): void {
    this.documents.push(document);
  }

  updateDocument(id: string, updates: Partial<KnowledgeDocument>): boolean {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index !== -1) {
      this.documents[index] = { ...this.documents[index], ...updates };
      return true;
    }
    return false;
  }
}

export const knowledgeBase = new KnowledgeBaseSearch();