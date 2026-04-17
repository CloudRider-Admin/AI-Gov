/**
 * Comprehensive Governance Knowledge Base
 *
 * Structured data covering the three major AI governance frameworks:
 * - NIST AI Risk Management Framework (AI RMF) 1.0
 * - EU AI Act (Regulation 2024/1689)
 * - ISO/IEC 42001:2023 AI Management System
 *
 * Plus cross-framework alignment mappings and implementation guidance.
 *
 * Consumed by:
 * - multiAgent.ts (agent framework context for risk, compliance, policy, implementation agents)
 * - seedData.ts (flattened into embeddable entries for pgvector search)
 */

// ─── NIST AI Risk Management Framework 1.0 ─────────────────────────────────

export const NIST_AI_RMF = {
  overview: {
    description:
      'The NIST AI Risk Management Framework (AI RMF) provides a structured approach for managing risks associated with AI systems throughout their lifecycle. It is voluntary, rights-preserving, non-sector-specific, and use-case agnostic, designed to be adapted by organizations of all sizes.',
    version: '1.0',
    releaseDate: 'January 2023',
    source: 'https://www.nist.gov/artificial-intelligence/ai-risk-management-framework',
  },

  implementationTiers: [
    {
      tier: 1,
      name: 'Partial',
      description:
        'AI risk management practices are ad hoc, reactive, and not consistently applied. Organizational awareness of AI risks is limited and risk management is performed on an irregular, case-by-case basis.',
    },
    {
      tier: 2,
      name: 'Risk Informed',
      description:
        'Risk management practices are approved by management but may not be established as organization-wide policy. Awareness of AI risks exists at the organizational level, but processes are not consistently repeatable.',
    },
    {
      tier: 3,
      name: 'Repeatable',
      description:
        'Risk management practices are formally established, documented as policy, and regularly updated. Organization-wide approaches to managing AI risk are defined and processes are consistently applied.',
    },
    {
      tier: 4,
      name: 'Adaptive',
      description:
        'The organization adapts its AI risk management practices based on lessons learned and predictive indicators. Continuous improvement processes incorporate advanced technologies and analytics to manage AI risks proactively.',
    },
  ],

  trustworthyCharacteristics: [
    {
      name: 'Valid and Reliable',
      description:
        'AI systems perform as intended, producing accurate and consistent results across deployment conditions. Validation and reliability testing is performed throughout the AI lifecycle.',
    },
    {
      name: 'Safe',
      description:
        'AI systems do not endanger human life, health, property, or the environment under defined conditions of use, including foreseeable misuse.',
    },
    {
      name: 'Secure and Resilient',
      description:
        'AI systems maintain confidentiality, integrity, and availability. They can withstand unexpected adverse events, including adversarial attacks, and recover gracefully.',
    },
    {
      name: 'Accountable and Transparent',
      description:
        'Appropriate mechanisms are in place so that relevant personnel can understand, access, and oversee AI system behavior. Decision-making processes are documented.',
    },
    {
      name: 'Explainable and Interpretable',
      description:
        'AI system outputs and processes can be understood by stakeholders at an appropriate level. Users can understand why an AI system made a particular decision or prediction.',
    },
    {
      name: 'Privacy-Enhanced',
      description:
        'AI systems are designed to respect privacy norms and offer privacy protections. Data collection, use, and retention are governed by established policies.',
    },
    {
      name: 'Fair — with Harmful Bias Managed',
      description:
        'AI systems are designed and deployed to identify, assess, and mitigate harmful biases. Equity and fairness are considered throughout the AI lifecycle.',
    },
  ],

  coreFunctions: {
    GOVERN: {
      name: 'GOVERN',
      description:
        'Cultivates and implements a culture of risk management within organizations designing, developing, deploying, evaluating, or acquiring AI systems.',
      purpose:
        'Establishes governance structures, policies, processes, and accountability mechanisms to manage AI risk across the organization.',
      keyActions: [
        'Establish AI governance policies, procedures, and processes',
        'Define roles, responsibilities, and lines of authority for AI risk management',
        'Develop and maintain an organizational AI risk management strategy',
        'Allocate resources for AI risk management activities',
        'Establish mechanisms for continuous monitoring and improvement of AI governance',
        'Align AI governance with enterprise risk management practices',
      ],
      categories: [
        {
          id: 'GV-1',
          name: 'Governance Policies',
          description:
            'Policies and procedures are in place to guide the organization\'s AI risk management activities. Legal and regulatory requirements are identified and addressed.',
          subcategories: [
            'GV-1.1: Legal and regulatory requirements involving AI are understood, managed, and documented',
            'GV-1.2: Processes to determine the scope of AI governance are established',
          ],
        },
        {
          id: 'GV-2',
          name: 'Governance Structures',
          description:
            'Accountability structures are in place so that appropriate teams and individuals are empowered, responsible, and trained for managing AI risk.',
          subcategories: [
            'GV-2.1: Roles and responsibilities for AI risk management are defined and assigned',
            'GV-2.2: Personnel are trained and equipped to manage AI risks effectively',
          ],
        },
        {
          id: 'GV-3',
          name: 'Risk Management Integration',
          description:
            'AI risk management is integrated into broader organizational risk management strategies and processes.',
          subcategories: [
            'GV-3.1: AI risk management is aligned with enterprise risk management practices',
            'GV-3.2: AI risk tolerances are determined and documented',
          ],
        },
        {
          id: 'GV-4',
          name: 'Organizational Oversight',
          description:
            'Organizational practices are in place to foster a culture of risk management and continuous improvement in AI governance.',
          subcategories: [
            'GV-4.1: Organizational awareness of AI risks is cultivated',
            'GV-4.2: Feedback mechanisms are in place for continuous improvement',
          ],
        },
      ],
    },
    MAP: {
      name: 'MAP',
      description:
        'Establishes and maintains the context to frame risks related to an AI system. Maps AI risks to organizational, technical, and societal contexts.',
      purpose:
        'Identifies and documents the context, purpose, benefits, costs, and risks associated with an AI system prior to design, development, and deployment.',
      keyActions: [
        'Identify intended purposes and potential beneficial and harmful impacts of AI systems',
        'Determine the scope and boundaries of the AI system\'s deployment context',
        'Map risks associated with AI system components, data, and third-party dependencies',
        'Assess impacts on individuals, groups, communities, organizations, and society',
        'Document assumptions, constraints, and limitations of AI systems',
        'Evaluate the suitability of existing risk frameworks for the AI use case',
      ],
      categories: [
        {
          id: 'MP-1',
          name: 'Context Establishment',
          description:
            'The context of the AI system is established, including its intended purpose, deployment environment, and stakeholders.',
          subcategories: [
            'MP-1.1: Intended purpose of the AI system is clearly defined',
            'MP-1.2: Interdependencies and deployment context are documented',
          ],
        },
        {
          id: 'MP-2',
          name: 'Risk Identification',
          description:
            'AI risks are identified based on technical, societal, and organizational factors.',
          subcategories: [
            'MP-2.1: Potential risks across the AI lifecycle are identified and categorized',
            'MP-2.2: AI system limitations and failure modes are documented',
          ],
        },
        {
          id: 'MP-3',
          name: 'Benefits and Costs',
          description:
            'Benefits and costs of AI systems are assessed and documented with input from diverse stakeholders.',
          subcategories: [
            'MP-3.1: Benefits and costs are assessed relative to available alternatives',
          ],
        },
        {
          id: 'MP-4',
          name: 'Impact Characterization',
          description:
            'Risks and impacts are characterized to inform mitigation strategies and monitoring priorities.',
          subcategories: [
            'MP-4.1: Impacts on individuals, communities, and organizations are characterized',
            'MP-4.2: Likelihood and severity of identified risks are estimated',
          ],
        },
      ],
    },
    MEASURE: {
      name: 'MEASURE',
      description:
        'Employs quantitative, qualitative, or mixed-method tools, techniques, and methodologies to analyze, assess, benchmark, and monitor AI risk and related impacts.',
      purpose:
        'Provides metrics, methodologies, and tools for measuring and tracking AI risks over time, enabling evidence-based decision-making.',
      keyActions: [
        'Define appropriate metrics and methodologies for measuring AI risks',
        'Conduct regular risk assessments and evaluations',
        'Benchmark AI system performance against trustworthiness characteristics',
        'Monitor AI systems for emerging risks and performance degradation',
        'Track and report on risk metrics to stakeholders',
        'Validate measurement approaches for relevance and accuracy',
      ],
      categories: [
        {
          id: 'MS-1',
          name: 'Risk Measurement',
          description:
            'Appropriate methods and metrics are identified and applied to measure AI risk and trustworthiness characteristics.',
          subcategories: [
            'MS-1.1: Approaches for measuring AI risks are developed and validated',
            'MS-1.2: Metrics cover all relevant trustworthiness characteristics',
          ],
        },
        {
          id: 'MS-2',
          name: 'Evaluation and Monitoring',
          description:
            'AI systems are evaluated and monitored for risks on an ongoing basis.',
          subcategories: [
            'MS-2.1: AI systems are evaluated against defined benchmarks and standards',
            'MS-2.2: Mechanisms are in place for ongoing monitoring and anomaly detection',
          ],
        },
        {
          id: 'MS-3',
          name: 'Risk Tracking',
          description:
            'AI risk measurements are tracked, reported, and used to inform decision-making.',
          subcategories: [
            'MS-3.1: Risk measurement results are documented and communicated',
            'MS-3.2: Risk tracking informs governance and operational decisions',
          ],
        },
      ],
    },
    MANAGE: {
      name: 'MANAGE',
      description:
        'Allocates risk resources to mapped and measured AI risks on a regular basis and as defined by the GOVERN function.',
      purpose:
        'Enables the prioritization, response, and monitoring of AI risks through concrete risk treatment actions aligned with organizational risk tolerances.',
      keyActions: [
        'Prioritize AI risks based on assessment results and organizational risk tolerances',
        'Plan and implement risk treatment actions (mitigate, transfer, accept, or avoid)',
        'Monitor the effectiveness of risk treatments and adjust as needed',
        'Establish processes for responding to AI incidents and failures',
        'Communicate residual risks to stakeholders',
        'Document risk management decisions and their rationale',
      ],
      categories: [
        {
          id: 'MG-1',
          name: 'Risk Prioritization',
          description:
            'AI risks are prioritized based on impact, likelihood, and organizational risk tolerance.',
          subcategories: [
            'MG-1.1: Risks are prioritized and resources allocated for treatment',
          ],
        },
        {
          id: 'MG-2',
          name: 'Risk Treatment',
          description:
            'Strategies to respond to identified and measured AI risks are planned, implemented, and monitored.',
          subcategories: [
            'MG-2.1: Risk treatment plans are developed and implemented',
            'MG-2.2: Effectiveness of risk treatments is evaluated and documented',
          ],
        },
        {
          id: 'MG-3',
          name: 'Risk Monitoring',
          description:
            'Responses to AI risks are monitored, and adjustments are made as needed.',
          subcategories: [
            'MG-3.1: Post-deployment monitoring plans are implemented',
            'MG-3.2: Risk response plans are updated based on monitoring results',
          ],
        },
      ],
    },
  },
};

// ─── EU AI Act (Regulation 2024/1689) ───────────────────────────────────────

export const EU_AI_ACT = {
  overview: {
    fullName: 'Regulation (EU) 2024/1689 — Artificial Intelligence Act',
    description:
      'The EU AI Act is the world\'s first comprehensive legal framework for AI. It establishes a risk-based regulatory approach, categorizing AI systems by risk level and imposing requirements accordingly. It applies to providers and deployers of AI systems in the EU market.',
    entryIntoForce: 'August 1, 2024',
    source: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
  },

  timeline: [
    { date: 'August 2024', milestone: 'Regulation enters into force' },
    { date: 'February 2025', milestone: 'Prohibited AI practices ban takes effect' },
    { date: 'August 2025', milestone: 'GPAI model obligations and governance rules apply' },
    { date: 'August 2026', milestone: 'High-risk AI system requirements become enforceable' },
    { date: 'August 2027', milestone: 'Full enforcement for all remaining provisions' },
  ],

  penalties: {
    prohibitedPractices: 'Up to EUR 35 million or 7% of worldwide annual turnover',
    highRiskViolations: 'Up to EUR 15 million or 3% of worldwide annual turnover',
    incorrectInformation: 'Up to EUR 7.5 million or 1.5% of worldwide annual turnover',
    smeReductions: 'Proportionate caps for SMEs and startups to avoid disproportionate burden',
  },

  governance: {
    aiOffice: 'EU AI Office — Oversees implementation of GPAI model rules and coordinates enforcement',
    aiBoard: 'European Artificial Intelligence Board — Advises and assists the Commission and Member States',
    nationalAuthorities: 'National Competent Authorities — Each Member State designates authorities for market surveillance',
    scientificPanel: 'Scientific Panel of Independent Experts — Provides technical expertise on GPAI models',
    advisoryForum: 'Advisory Forum — Represents diverse stakeholder interests in AI governance',
  },

  riskCategories: {
    UNACCEPTABLE: {
      level: 'Unacceptable',
      status: 'Banned',
      effectiveDate: 'February 2025',
      description:
        'AI practices that pose an unacceptable risk to fundamental rights are prohibited outright.',
      prohibitedPractices: [
        {
          id: 'A5-1a',
          name: 'Subliminal Manipulation',
          description:
            'AI systems that deploy subliminal, manipulative, or deceptive techniques to distort behavior and impair informed decision-making, causing significant harm.',
        },
        {
          id: 'A5-1b',
          name: 'Exploitation of Vulnerabilities',
          description:
            'AI systems that exploit vulnerabilities of specific groups due to age, disability, or social or economic situation to materially distort behavior.',
        },
        {
          id: 'A5-1c',
          name: 'Social Scoring',
          description:
            'AI systems used by public authorities or on their behalf for social scoring — evaluating or classifying individuals based on social behavior or personal characteristics leading to detrimental treatment.',
        },
        {
          id: 'A5-1d',
          name: 'Criminal Offense Risk Assessment',
          description:
            'AI systems that assess the risk of natural persons committing criminal offenses solely based on profiling or personality traits, except when used to augment human assessments based on objective facts.',
        },
        {
          id: 'A5-1e',
          name: 'Untargeted Facial Image Scraping',
          description:
            'AI systems that create or expand facial recognition databases through untargeted scraping of facial images from the internet or CCTV footage.',
        },
        {
          id: 'A5-1f',
          name: 'Emotion Recognition in Workplace/Education',
          description:
            'AI systems that infer emotions of natural persons in workplace and educational institutions, except where for medical or safety reasons.',
        },
        {
          id: 'A5-1g',
          name: 'Biometric Categorization (Sensitive Attributes)',
          description:
            'AI systems that categorize natural persons based on biometric data to deduce race, political opinions, trade union membership, religious beliefs, or sexual orientation.',
        },
        {
          id: 'A5-1h',
          name: 'Real-Time Remote Biometric Identification',
          description:
            'Use of real-time remote biometric identification systems in publicly accessible spaces for law enforcement, except in narrowly defined exceptions.',
        },
      ],
    },
    HIGH_RISK: {
      level: 'High',
      status: 'Regulated — Conformity assessment required',
      effectiveDate: 'August 2026',
      description:
        'AI systems that pose significant risk to health, safety, or fundamental rights are subject to mandatory requirements before being placed on the market.',
      useCaseAreas: [
        {
          area: 'Biometric Identification',
          examples: ['Remote biometric identification', 'Biometric categorization', 'Emotion recognition'],
        },
        {
          area: 'Critical Infrastructure',
          examples: ['Road traffic safety', 'Water/gas/electricity supply management', 'Digital infrastructure'],
        },
        {
          area: 'Education & Training',
          examples: ['Admissions decisions', 'Student performance assessment', 'Learning behavior monitoring'],
        },
        {
          area: 'Employment & Workers',
          examples: ['Recruitment and screening', 'Promotion and termination decisions', 'Task allocation and monitoring'],
        },
        {
          area: 'Essential Services',
          examples: ['Credit scoring', 'Insurance risk assessment', 'Emergency services dispatch'],
        },
        {
          area: 'Law Enforcement',
          examples: ['Risk assessment of individuals', 'Polygraph and deception detection', 'Evidence evaluation'],
        },
        {
          area: 'Migration & Border Control',
          examples: ['Visa application assessment', 'Border surveillance', 'Asylum claim processing'],
        },
        {
          area: 'Justice & Democracy',
          examples: ['Court decision support', 'Legal research and analysis', 'Election influence assessment'],
        },
      ],
      requirements: [
        {
          name: 'Risk Management System',
          description: 'Establish and maintain a risk management system throughout the AI system lifecycle, including identification, analysis, estimation, and evaluation of risks.',
        },
        {
          name: 'Data Governance',
          description: 'Training, validation, and testing datasets must be subject to appropriate data governance and management practices, ensuring relevance, representativeness, and freedom from errors.',
        },
        {
          name: 'Technical Documentation',
          description: 'Draw up technical documentation before the system is placed on the market, demonstrating compliance and enabling assessment by national authorities.',
        },
        {
          name: 'Record-Keeping (Logging)',
          description: 'AI systems must allow automatic recording of events (logs) over their lifetime to ensure traceability of system functioning.',
        },
        {
          name: 'Transparency & Information',
          description: 'AI systems must be designed to ensure sufficient transparency for deployers to interpret and use outputs appropriately. Instructions for use must be provided.',
        },
        {
          name: 'Human Oversight',
          description: 'AI systems must be designed to allow effective human oversight, including the ability to understand, monitor, and intervene in system operation.',
        },
        {
          name: 'Accuracy, Robustness, and Cybersecurity',
          description: 'AI systems must achieve appropriate levels of accuracy, robustness, and cybersecurity and perform consistently throughout their lifecycle.',
        },
        {
          name: 'Quality Management System',
          description: 'Providers of high-risk AI systems must establish a quality management system ensuring compliance with the regulation.',
        },
        {
          name: 'Conformity Assessment',
          description: 'High-risk AI systems must undergo conformity assessment procedures before being placed on the market or put into service.',
        },
        {
          name: 'EU Declaration of Conformity',
          description: 'Providers must draw up an EU declaration of conformity for each high-risk AI system and keep it available for national authorities.',
        },
        {
          name: 'CE Marking',
          description: 'High-risk AI systems that comply must bear the CE marking to indicate conformity.',
        },
      ],
    },
    LIMITED_RISK: {
      level: 'Limited',
      status: 'Transparency obligations',
      effectiveDate: 'August 2026',
      description:
        'AI systems that interact with natural persons or generate synthetic content are subject to specific transparency obligations.',
      requirements: [
        {
          name: 'Chatbot Disclosure',
          description: 'AI systems intended to directly interact with natural persons must be designed so that individuals are informed they are interacting with an AI system.',
        },
        {
          name: 'Deepfake Labeling',
          description: 'AI-generated or manipulated images, audio, or video content (deepfakes) must be labeled as artificially generated or manipulated.',
        },
        {
          name: 'Emotion Recognition Disclosure',
          description: 'Users of emotion recognition systems must inform natural persons that they are being exposed to such a system.',
        },
        {
          name: 'AI-Generated Content Marking',
          description: 'Providers of AI systems generating synthetic content must ensure outputs are marked in a machine-readable format as artificially generated.',
        },
      ],
    },
  },

  gpaiRules: {
    effectiveDate: 'August 2025',
    description:
      'General-purpose AI (GPAI) models, including large language models and foundation models, are subject to specific obligations based on their impact and risk profile.',
    obligations: [
      'Draw up and maintain technical documentation of the model including training and testing processes',
      'Provide information and documentation to downstream providers integrating the model into AI systems',
      'Establish a policy to comply with EU copyright law, including the text and data mining opt-out',
      'Publish a sufficiently detailed summary of training data content',
    ],
    systemicRiskObligations: [
      'Perform model evaluations including adversarial testing to identify and mitigate systemic risks',
      'Assess and mitigate possible systemic risks at the Union level',
      'Track, document, and report serious incidents to the AI Office and national authorities',
      'Ensure adequate cybersecurity protections for the model and its physical infrastructure',
    ],
  },
};

// ─── ISO/IEC 42001:2023 — AI Management System ─────────────────────────────

export const ISO_42001 = {
  overview: {
    fullName: 'ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system',
    description:
      'ISO/IEC 42001 specifies requirements for establishing, implementing, maintaining, and continually improving an Artificial Intelligence Management System (AIMS) within organizations. It provides a systematic approach to managing AI-related risks and opportunities.',
    publishDate: 'December 2023',
    source: 'https://www.iso.org/standard/81230.html',
  },

  keyPrinciples: [
    {
      name: 'Risk-Based Thinking',
      description: 'Apply risk-based thinking to all AI management system activities, addressing both risks and opportunities associated with AI.',
    },
    {
      name: 'Responsible AI',
      description: 'Ensure AI systems are developed and used responsibly, considering ethical implications, fairness, transparency, and accountability.',
    },
    {
      name: 'Continual Improvement',
      description: 'Continually improve the suitability, adequacy, and effectiveness of the AI management system through systematic evaluation and updates.',
    },
    {
      name: 'Stakeholder Engagement',
      description: 'Identify and engage relevant stakeholders throughout the AI lifecycle to understand needs, expectations, and potential impacts.',
    },
  ],

  certificationProcess: [
    {
      phase: 1,
      name: 'Gap Analysis',
      description: 'Assess current AI practices against ISO 42001 requirements to identify gaps and plan remediation activities.',
    },
    {
      phase: 2,
      name: 'AIMS Implementation',
      description: 'Implement the AI management system including policies, procedures, controls, and documentation required by the standard.',
    },
    {
      phase: 3,
      name: 'Internal Audit',
      description: 'Conduct an internal audit to verify the AIMS is effectively implemented and conforms to the standard requirements.',
    },
    {
      phase: 4,
      name: 'Certification Audit',
      description: 'Engage an accredited certification body to perform Stage 1 (documentation review) and Stage 2 (implementation audit) assessments.',
    },
    {
      phase: 5,
      name: 'Continuous Surveillance',
      description: 'Undergo periodic surveillance audits (typically annually) to maintain certification and demonstrate continuous improvement.',
    },
  ],

  annexes: {
    A: {
      name: 'Annex A — AI Controls',
      description: 'Reference set of AI-specific controls covering AI policies, internal organization, resources, AI system lifecycle, third-party relations, data, and system performance.',
    },
    B: {
      name: 'Annex B — Implementation Guidance',
      description: 'Provides guidance on implementing the controls listed in Annex A, with practical examples and recommendations.',
    },
    C: {
      name: 'Annex C — AI-Specific Risk Sources',
      description: 'Identifies potential sources of AI-related risk, organized by lifecycle phase, to support comprehensive risk assessment.',
    },
    D: {
      name: 'Annex D — AI Domain/Sector Use',
      description: 'Provides guidance on applying the standard within specific domains and sectors, acknowledging varying risk profiles.',
    },
  },

  clauses: {
    clause1: {
      number: 1,
      name: 'Scope',
      description: 'Defines the scope of the standard, specifying that it applies to any organization that develops, provides, or uses AI-based products or services.',
    },
    clause2: {
      number: 2,
      name: 'Normative References',
      description: 'Lists normatively referenced documents required for the application of this standard.',
    },
    clause3: {
      number: 3,
      name: 'Terms and Definitions',
      description: 'Defines key terms used throughout the standard, ensuring consistent interpretation by all users.',
    },
    clause4: {
      number: 4,
      name: 'Context of the Organization',
      description: 'Requires the organization to determine external and internal issues, interested parties, and the scope of the AIMS relevant to its AI activities.',
      requirements: [
        {
          id: '4.1',
          name: 'Understanding the Organization and its Context',
          description: 'Determine external and internal issues relevant to the organization\'s purpose and that affect its ability to achieve the intended outcomes of the AIMS.',
        },
        {
          id: '4.2',
          name: 'Understanding Interested Parties',
          description: 'Determine interested parties relevant to the AIMS, their requirements, and which will be addressed through the management system.',
        },
        {
          id: '4.3',
          name: 'Scope of the AIMS',
          description: 'Determine the boundaries and applicability of the AIMS, considering internal and external issues and stakeholder requirements.',
        },
        {
          id: '4.4',
          name: 'AI Management System',
          description: 'Establish, implement, maintain, and continually improve an AIMS in accordance with the requirements of this standard.',
        },
      ],
    },
    clause5: {
      number: 5,
      name: 'Leadership',
      description: 'Top management must demonstrate leadership and commitment to the AIMS by establishing policy, assigning roles, and ensuring resources.',
      requirements: [
        {
          id: '5.1',
          name: 'Leadership and Commitment',
          description: 'Top management shall demonstrate leadership and commitment by ensuring AI policy and objectives are established and compatible with strategic direction.',
        },
        {
          id: '5.2',
          name: 'AI Policy',
          description: 'Establish an AI policy that is appropriate, provides a framework for objectives, includes commitment to compliance, and is communicated and available.',
        },
        {
          id: '5.3',
          name: 'Organizational Roles, Responsibilities, and Authorities',
          description: 'Top management shall ensure responsibilities and authorities for relevant roles are assigned, communicated, and understood within the organization.',
        },
      ],
    },
    clause6: {
      number: 6,
      name: 'Planning',
      description: 'The organization shall plan actions to address risks and opportunities, set AI objectives, and plan changes to the AIMS.',
      requirements: [
        {
          id: '6.1',
          name: 'Actions to Address Risks and Opportunities',
          description: 'Determine risks and opportunities that need to be addressed to ensure the AIMS achieves its intended outcomes, prevents undesired effects, and achieves continual improvement.',
          subRequirements: [
            '6.1.1 General risk and opportunity identification',
            '6.1.2 AI risk assessment process',
            '6.1.3 AI risk treatment',
            '6.1.4 AI system impact assessment',
          ],
        },
        {
          id: '6.2',
          name: 'AI Objectives and Planning to Achieve Them',
          description: 'Establish AI objectives at relevant functions, levels, and processes. Objectives must be consistent with the AI policy, measurable, monitored, and communicated.',
        },
        {
          id: '6.3',
          name: 'Planning of Changes',
          description: 'When changes to the AIMS are needed, the organization shall plan the changes in a systematic manner.',
        },
      ],
    },
    clause7: {
      number: 7,
      name: 'Support',
      description: 'The organization shall determine and provide resources, competence, awareness, communication, and documented information for the AIMS.',
      requirements: [
        {
          id: '7.1',
          name: 'Resources',
          description: 'Determine and provide the resources needed for the establishment, implementation, maintenance, and continual improvement of the AIMS.',
        },
        {
          id: '7.2',
          name: 'Competence',
          description: 'Determine necessary competence of persons doing work that affects AI performance, ensure persons are competent through education, training, or experience.',
        },
        {
          id: '7.3',
          name: 'Awareness',
          description: 'Persons working under the organization\'s control shall be aware of the AI policy, their contribution, and implications of not conforming.',
        },
        {
          id: '7.4',
          name: 'Communication',
          description: 'Determine internal and external communications relevant to the AIMS, including what, when, with whom, and how to communicate.',
        },
        {
          id: '7.5',
          name: 'Documented Information',
          description: 'The AIMS shall include documented information required by this standard and determined as necessary for AIMS effectiveness.',
          subRequirements: [
            '7.5.1 General documentation requirements',
            '7.5.2 Creating and updating documented information',
            '7.5.3 Control of documented information',
          ],
        },
      ],
    },
    clause8: {
      number: 8,
      name: 'Operation',
      description: 'The organization shall plan, implement, and control the processes needed to meet AIMS requirements and implement AI risk treatment actions.',
      requirements: [
        {
          id: '8.1',
          name: 'Operational Planning and Control',
          description: 'Plan, implement, and control processes needed to meet requirements including criteria for processes and control of processes in accordance with criteria.',
        },
        {
          id: '8.2',
          name: 'AI Risk Assessment',
          description: 'Perform AI risk assessments at planned intervals or when significant changes are proposed, retaining documented information of results.',
        },
        {
          id: '8.3',
          name: 'AI Risk Treatment',
          description: 'Implement the AI risk treatment plan and retain documented information of the results of AI risk treatment.',
        },
        {
          id: '8.4',
          name: 'AI System Impact Assessment',
          description: 'Conduct impact assessments for AI systems addressing potential impacts on individuals, groups, and societies.',
        },
      ],
    },
    clause9: {
      number: 9,
      name: 'Performance Evaluation',
      description: 'The organization shall monitor, measure, analyze, evaluate, audit, and review the AIMS to ensure it remains effective.',
      requirements: [
        {
          id: '9.1',
          name: 'Monitoring, Measurement, Analysis, and Evaluation',
          description: 'Determine what needs to be monitored and measured, the methods, when monitoring is performed, and when results are analyzed and evaluated.',
        },
        {
          id: '9.2',
          name: 'Internal Audit',
          description: 'Conduct internal audits at planned intervals to confirm the AIMS conforms to requirements and is effectively implemented and maintained.',
          subRequirements: [
            '9.2.1 Establish, implement, and maintain an audit program',
            '9.2.2 Define audit criteria and scope for each audit',
          ],
        },
        {
          id: '9.3',
          name: 'Management Review',
          description: 'Top management shall review the AIMS at planned intervals to ensure its continuing suitability, adequacy, effectiveness, and alignment with strategic direction.',
          subRequirements: [
            '9.3.1 General management review requirements',
            '9.3.2 Management review inputs',
            '9.3.3 Management review outputs',
          ],
        },
      ],
    },
    clause10: {
      number: 10,
      name: 'Improvement',
      description: 'The organization shall determine opportunities for improvement and implement necessary actions to continually improve the AIMS.',
      requirements: [
        {
          id: '10.1',
          name: 'Continual Improvement',
          description: 'Continually improve the suitability, adequacy, and effectiveness of the AIMS through the use of AI policy, objectives, audit results, analysis, corrective actions, and management review.',
        },
        {
          id: '10.2',
          name: 'Nonconformity and Corrective Action',
          description: 'When a nonconformity occurs, react to it, evaluate the need for corrective action, implement changes, and review effectiveness of actions taken.',
        },
      ],
    },
  },
};

// ─── Framework Cross-Reference Alignment ────────────────────────────────────

export const FRAMEWORK_ALIGNMENT = {
  nistToIso: {
    description:
      'Mapping between NIST AI RMF core functions and ISO/IEC 42001 clauses, showing how organizations can satisfy both frameworks with aligned processes.',
    mappings: [
      {
        nistFunction: 'GOVERN',
        isoClause: 'Clause 5 (Leadership) + Clause 6 (Planning)',
        alignment: 'NIST GOVERN aligns with ISO 42001 leadership commitment, AI policy establishment, role assignment, risk/opportunity planning, and AIMS objectives.',
      },
      {
        nistFunction: 'MAP',
        isoClause: 'Clause 4 (Context) + Clause 8.4 (Impact Assessment)',
        alignment: 'NIST MAP aligns with ISO 42001 context of the organization, interested parties analysis, scope determination, and AI system impact assessments.',
      },
      {
        nistFunction: 'MEASURE',
        isoClause: 'Clause 9 (Performance Evaluation)',
        alignment: 'NIST MEASURE aligns with ISO 42001 monitoring, measurement, internal audit, and management review processes for evaluating AIMS effectiveness.',
      },
      {
        nistFunction: 'MANAGE',
        isoClause: 'Clause 8 (Operation) + Clause 10 (Improvement)',
        alignment: 'NIST MANAGE aligns with ISO 42001 operational risk treatment, corrective action, and continual improvement processes.',
      },
    ],
  },
  euAiActToNist: {
    description:
      'Mapping between EU AI Act requirements for high-risk AI systems and NIST AI RMF functions, enabling organizations to use the NIST framework as an implementation guide for regulatory compliance.',
    mappings: [
      {
        euRequirement: 'Risk Management System (Art. 9)',
        nistFunction: 'GOVERN + MAP + MEASURE + MANAGE',
        alignment: 'The EU AI Act risk management system requirement maps across all four NIST functions — governance structure, risk identification, measurement, and treatment.',
      },
      {
        euRequirement: 'Data Governance (Art. 10)',
        nistFunction: 'MAP + MEASURE',
        alignment: 'EU data governance requirements for training and testing data map to NIST MAP (data risk identification) and MEASURE (data quality metrics and monitoring).',
      },
      {
        euRequirement: 'Technical Documentation (Art. 11)',
        nistFunction: 'GOVERN + MAP',
        alignment: 'EU documentation requirements map to NIST GOVERN (documentation policies) and MAP (system context and risk documentation).',
      },
      {
        euRequirement: 'Transparency & Human Oversight (Art. 13-14)',
        nistFunction: 'GOVERN + MANAGE',
        alignment: 'EU transparency and oversight requirements map to NIST GOVERN (oversight policies) and MANAGE (operational controls for human-AI interaction).',
      },
      {
        euRequirement: 'Accuracy, Robustness, Cybersecurity (Art. 15)',
        nistFunction: 'MEASURE + MANAGE',
        alignment: 'EU performance and security requirements map to NIST MEASURE (benchmarking and testing) and MANAGE (risk treatment and incident response).',
      },
    ],
  },
};

// ─── Implementation Guidance ────────────────────────────────────────────────

export const IMPLEMENTATION_GUIDANCE = {
  smbRoadmap: {
    phase1: {
      name: 'Phase 1: Foundation (Months 1-3)',
      activities: [
        'Conduct an AI use case inventory across the organization',
        'Identify quick-win governance gaps and risk exposures',
        'Draft an initial AI Acceptable Use Policy',
        'Assign an AI governance lead or committee',
        'Establish basic incident reporting procedures',
      ],
    },
    phase2: {
      name: 'Phase 2: Formalization (Months 4-6)',
      activities: [
        'Perform structured risk assessments for all identified AI use cases',
        'Develop formal AI governance policies and procedures',
        'Implement data governance practices for AI training and inference data',
        'Create vendor/third-party AI assessment process',
        'Begin employee awareness training on responsible AI use',
      ],
    },
    phase3: {
      name: 'Phase 3: Operationalization (Months 7-9)',
      activities: [
        'Implement monitoring and logging for high-risk AI systems',
        'Establish regular governance review cadence (monthly or quarterly)',
        'Build internal audit capability for AI systems',
        'Document technical specifications and model cards',
        'Develop bias testing and fairness evaluation procedures',
      ],
    },
    phase4: {
      name: 'Phase 4: Maturation (Months 10-12)',
      activities: [
        'Conduct first internal AI governance audit',
        'Review and update all policies based on lessons learned',
        'Benchmark governance maturity against NIST implementation tiers',
        'Prepare for external certification if pursuing ISO 42001',
        'Establish continuous improvement mechanisms and KPIs',
      ],
    },
  },

  riskAssessmentTemplate: {
    categories: [
      {
        name: 'Technical Risk',
        factors: [
          'Model accuracy and reliability under production conditions',
          'Data quality, completeness, and representativeness',
          'System robustness against adversarial inputs',
          'Cybersecurity vulnerabilities in AI pipeline',
          'Scalability and performance degradation risks',
        ],
      },
      {
        name: 'Ethical Risk',
        factors: [
          'Potential for discriminatory outcomes or bias amplification',
          'Impact on individual autonomy and decision-making',
          'Transparency and explainability of AI outputs',
          'Privacy implications of data collection and processing',
          'Environmental impact of AI training and inference',
        ],
      },
      {
        name: 'Regulatory Risk',
        factors: [
          'EU AI Act classification and compliance obligations',
          'GDPR compliance for personal data processing',
          'Sector-specific regulations (financial, healthcare, etc.)',
          'Cross-border regulatory differences',
          'Evolving regulatory landscape and future requirements',
        ],
      },
      {
        name: 'Operational Risk',
        factors: [
          'Dependency on third-party AI services and vendors',
          'Organizational readiness and skill gaps',
          'Change management and user adoption challenges',
          'Business continuity and failover planning',
          'Integration complexity with existing systems',
        ],
      },
      {
        name: 'Reputational Risk',
        factors: [
          'Public perception of AI use in the business context',
          'Media scrutiny and negative coverage potential',
          'Customer trust impact from AI-driven decisions',
          'Competitive implications of governance posture',
          'Stakeholder expectations for responsible AI',
        ],
      },
    ],
    riskLevels: [
      { level: 'Critical', score: '20-25', action: 'Immediate remediation required. Suspend AI use until risks are mitigated to acceptable levels.' },
      { level: 'High', score: '15-19', action: 'Priority remediation within 30 days. Implement compensating controls immediately.' },
      { level: 'Medium', score: '10-14', action: 'Planned remediation within 90 days. Monitor with enhanced oversight.' },
      { level: 'Low', score: '5-9', action: 'Accept with standard monitoring. Review during regular governance cycles.' },
      { level: 'Minimal', score: '1-4', action: 'Accept risk. Include in routine governance review.' },
    ],
  },
};
