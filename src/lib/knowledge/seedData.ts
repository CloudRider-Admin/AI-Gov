/**
 * Comprehensive Knowledge Seed Data
 *
 * Flattens ALL structured governance knowledge into individual embeddable entries
 * for the KnowledgeEntry table. Each entry is a self-contained, semantically
 * meaningful chunk optimized for vector search (pgvector cosine similarity).
 *
 * Sources:
 * - governanceKnowledge.ts (NIST AI RMF, EU AI Act, ISO 42001, Framework Alignment)
 * - nistPlaybook.json (72 NIST subcategory entries)
 * - Additional GDPR articles for AI context
 * - Cross-framework compliance mapping
 */

import { NIST_AI_RMF, EU_AI_ACT, ISO_42001, FRAMEWORK_ALIGNMENT, IMPLEMENTATION_GUIDANCE } from '@/data/governanceKnowledge';

interface SeedEntry {
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: string;
  sourceType: string;
}

// ─── NIST AI RMF Entries ─────────────────────────────────────────────────────

function buildNistEntries(): SeedEntry[] {
  const entries: SeedEntry[] = [];

  // Overview
  entries.push({
    title: 'NIST AI RMF 1.0 — Overview and Structure',
    content: `${NIST_AI_RMF.overview.description}\n\nThe framework is organized into four core functions: GOVERN, MAP, MEASURE, and MANAGE. Each function contains categories and subcategories that provide specific guidance for managing AI risks.\n\nVersion: ${NIST_AI_RMF.overview.version}\nRelease Date: ${NIST_AI_RMF.overview.releaseDate}\nSource: ${NIST_AI_RMF.overview.source}\n\nImplementation Tiers:\n${NIST_AI_RMF.implementationTiers.map(t => `- Tier ${t.tier} (${t.name}): ${t.description}`).join('\n')}\n\nTrustworthy AI Characteristics:\n${NIST_AI_RMF.trustworthyCharacteristics.map(c => `- ${c.name}: ${c.description}`).join('\n')}`,
    category: 'framework',
    tags: ['NIST', 'AI RMF', 'risk management', 'framework', 'overview'],
    source: 'NIST AI Risk Management Framework 1.0',
    sourceType: 'nist',
  });

  // Each core function with all categories and subcategories
  for (const [key, func] of Object.entries(NIST_AI_RMF.coreFunctions)) {
    const funcData = func as typeof NIST_AI_RMF.coreFunctions.GOVERN;

    // Function-level entry
    entries.push({
      title: `NIST AI RMF — ${funcData.name} Function`,
      content: `${funcData.description}\n\nPurpose: ${funcData.purpose}\n\nCategories:\n${funcData.categories.map(c => `- ${c.id} (${c.name}): ${c.description}`).join('\n')}\n\nKey Actions:\n${funcData.keyActions.map(a => `- ${a}`).join('\n')}`,
      category: 'framework',
      tags: ['NIST', 'AI RMF', funcData.name, key],
      source: 'NIST AI Risk Management Framework 1.0',
      sourceType: 'nist',
    });

    // Each category with its subcategories
    for (const cat of funcData.categories) {
      entries.push({
        title: `NIST AI RMF — ${cat.id}: ${cat.name}`,
        content: `Framework: NIST AI RMF 1.0\nFunction: ${funcData.name}\nCategory: ${cat.id} — ${cat.name}\n\n${cat.description}\n\nSubcategories:\n${cat.subcategories.map(s => `- ${s}`).join('\n')}`,
        category: 'framework',
        tags: ['NIST', 'AI RMF', funcData.name, cat.id, cat.name],
        source: 'NIST AI Risk Management Framework 1.0',
        sourceType: 'nist',
      });
    }
  }

  return entries;
}

// ─── EU AI Act Entries ───────────────────────────────────────────────────────

function buildEuAiActEntries(): SeedEntry[] {
  const entries: SeedEntry[] = [];

  // Overview
  entries.push({
    title: 'EU AI Act (Regulation 2024/1689) — Overview',
    content: `${EU_AI_ACT.overview.fullName}\n\n${EU_AI_ACT.overview.description}\n\nEntry into Force: ${EU_AI_ACT.overview.entryIntoForce}\nSource: ${EU_AI_ACT.overview.source}\n\nTimeline:\n${EU_AI_ACT.timeline.map(t => `- ${t.date}: ${t.milestone}`).join('\n')}\n\nPenalties:\n- Prohibited practices: ${EU_AI_ACT.penalties.prohibitedPractices}\n- High-risk violations: ${EU_AI_ACT.penalties.highRiskViolations}\n- Incorrect information: ${EU_AI_ACT.penalties.incorrectInformation}\n- SME reductions: ${EU_AI_ACT.penalties.smeReductions}\n\nGovernance Bodies:\n- ${EU_AI_ACT.governance.aiOffice}\n- ${EU_AI_ACT.governance.aiBoard}\n- ${EU_AI_ACT.governance.nationalAuthorities}\n- ${EU_AI_ACT.governance.scientificPanel}\n- ${EU_AI_ACT.governance.advisoryForum}`,
    category: 'regulation',
    tags: ['EU AI Act', 'regulation', 'compliance', 'overview', 'penalties', 'timeline'],
    source: 'EU AI Act (Regulation 2024/1689)',
    sourceType: 'regulation',
  });

  // Prohibited practices (Unacceptable Risk)
  const unacceptable = EU_AI_ACT.riskCategories.UNACCEPTABLE;
  entries.push({
    title: 'EU AI Act — Prohibited AI Practices (Unacceptable Risk)',
    content: `Risk Level: ${unacceptable.level}\nStatus: ${unacceptable.status}\nEffective Date: ${unacceptable.effectiveDate}\n\n${unacceptable.description}\n\nThe following AI practices are banned under the EU AI Act:\n\n${unacceptable.prohibitedPractices.map(p => `${p.id}. ${p.name}\n   ${p.description}`).join('\n\n')}\n\nViolations carry penalties up to ${EU_AI_ACT.penalties.prohibitedPractices}.`,
    category: 'regulation',
    tags: ['EU AI Act', 'prohibited', 'unacceptable risk', 'banned AI', 'social scoring', 'biometrics', 'manipulation'],
    source: 'EU AI Act — Article 5 (Prohibited Practices)',
    sourceType: 'regulation',
  });

  // High-Risk AI Systems
  const highRisk = EU_AI_ACT.riskCategories.HIGH_RISK;
  entries.push({
    title: 'EU AI Act — High-Risk AI Systems',
    content: `Risk Level: ${highRisk.level}\nStatus: ${highRisk.status}\nEffective Date: ${highRisk.effectiveDate}\n\n${highRisk.description}\n\nHigh-Risk Use Case Areas:\n${highRisk.useCaseAreas.map(a => `\n${a.area}:\n${a.examples.map(e => `  - ${e}`).join('\n')}`).join('\n')}`,
    category: 'regulation',
    tags: ['EU AI Act', 'high-risk', 'Annex III', 'compliance requirements', 'use cases'],
    source: 'EU AI Act — Annex III (High-Risk AI Systems)',
    sourceType: 'regulation',
  });

  // High-Risk Requirements (detailed)
  entries.push({
    title: 'EU AI Act — High-Risk AI System Requirements',
    content: `Requirements for High-Risk AI Systems under the EU AI Act (Chapter III, Section 2):\n\n${highRisk.requirements.map((r, i) => `${i + 1}. ${r.name}\n   ${r.description}`).join('\n\n')}\n\nProviders must comply with all requirements before placing high-risk AI systems on the EU market or putting them into service. Non-compliance carries penalties up to ${EU_AI_ACT.penalties.highRiskViolations}.`,
    category: 'regulation',
    tags: ['EU AI Act', 'high-risk', 'requirements', 'risk management', 'data governance', 'human oversight', 'transparency', 'conformity assessment'],
    source: 'EU AI Act — Articles 8-15 (High-Risk Requirements)',
    sourceType: 'regulation',
  });

  // Limited Risk
  const limited = EU_AI_ACT.riskCategories.LIMITED_RISK;
  entries.push({
    title: 'EU AI Act — Limited Risk AI (Transparency Obligations)',
    content: `Risk Level: ${limited.level}\nStatus: ${limited.status}\nEffective Date: ${limited.effectiveDate}\n\n${limited.description}\n\nTransparency Requirements:\n${limited.requirements.map(r => `- ${r.name}: ${r.description}`).join('\n')}\n\nThese obligations ensure users know when they are interacting with AI systems, particularly chatbots, deepfakes, and emotion recognition systems.`,
    category: 'regulation',
    tags: ['EU AI Act', 'limited risk', 'transparency', 'chatbot', 'deepfake', 'disclosure'],
    source: 'EU AI Act — Article 50 (Transparency)',
    sourceType: 'regulation',
  });

  // GPAI Rules
  entries.push({
    title: 'EU AI Act — General-Purpose AI (GPAI) Model Rules',
    content: `Effective Date: ${EU_AI_ACT.gpaiRules.effectiveDate}\n\n${EU_AI_ACT.gpaiRules.description}\n\nGeneral Obligations for all GPAI Models:\n${EU_AI_ACT.gpaiRules.obligations.map(o => `- ${o}`).join('\n')}\n\nAdditional Obligations for GPAI with Systemic Risk:\n${EU_AI_ACT.gpaiRules.systemicRiskObligations.map(o => `- ${o}`).join('\n')}\n\nGPAI models with systemic risk are identified based on cumulative compute used for training, measured in FLOPs. The current threshold is 10^25 FLOPs. These models require additional safeguards including adversarial testing, incident reporting, and cybersecurity measures.`,
    category: 'regulation',
    tags: ['EU AI Act', 'GPAI', 'general-purpose AI', 'foundation models', 'systemic risk', 'LLM'],
    source: 'EU AI Act — Chapter V (GPAI Models)',
    sourceType: 'regulation',
  });

  return entries;
}

// ─── ISO 42001 Entries ───────────────────────────────────────────────────────

function buildIso42001Entries(): SeedEntry[] {
  const entries: SeedEntry[] = [];

  // Overview
  entries.push({
    title: 'ISO/IEC 42001:2023 — AI Management System Overview',
    content: `${ISO_42001.overview.fullName}\n\n${ISO_42001.overview.description}\n\nPublished: ${ISO_42001.overview.publishDate}\nSource: ${ISO_42001.overview.source}\n\nKey Principles:\n${ISO_42001.keyPrinciples.map(p => `- ${p.name}: ${p.description}`).join('\n')}\n\nCertification Process:\n${ISO_42001.certificationProcess.map(p => `Phase ${p.phase}: ${p.name} — ${p.description}`).join('\n')}\n\nAnnexes:\n${Object.values(ISO_42001.annexes).map(a => `- ${a.name}: ${a.description}`).join('\n')}`,
    category: 'framework',
    tags: ['ISO 42001', 'AIMS', 'management system', 'certification', 'overview'],
    source: 'ISO/IEC 42001:2023',
    sourceType: 'static',
  });

  // Each clause as a separate entry
  for (const [, clauseData] of Object.entries(ISO_42001.clauses)) {
    const clause = clauseData as { number: number; name: string; description: string; requirements?: Array<{ id: string; name: string; description: string; subRequirements?: string[] }> };

    let content = `ISO/IEC 42001:2023 — Clause ${clause.number}: ${clause.name}\n\n${clause.description}`;

    if (clause.requirements) {
      content += `\n\nRequirements:\n${clause.requirements.map(r => {
        let reqText = `- ${r.id} ${r.name}: ${r.description}`;
        if (r.subRequirements) {
          reqText += `\n${r.subRequirements.map(s => `  - ${s}`).join('\n')}`;
        }
        return reqText;
      }).join('\n')}`;
    }

    entries.push({
      title: `ISO 42001 — Clause ${clause.number}: ${clause.name}`,
      content,
      category: 'framework',
      tags: ['ISO 42001', `Clause ${clause.number}`, clause.name, 'AIMS'],
      source: 'ISO/IEC 42001:2023',
      sourceType: 'static',
    });
  }

  return entries;
}

// ─── Framework Cross-Reference Entries ───────────────────────────────────────

function buildCrossReferenceEntries(): SeedEntry[] {
  const entries: SeedEntry[] = [];

  // NIST ↔ ISO mapping
  entries.push({
    title: 'Framework Alignment — NIST AI RMF to ISO 42001 Mapping',
    content: `${FRAMEWORK_ALIGNMENT.nistToIso.description}\n\nMappings:\n${FRAMEWORK_ALIGNMENT.nistToIso.mappings.map(m => `- ${m.nistFunction} → ${m.isoClause}\n  ${m.alignment}`).join('\n')}\n\nThis mapping helps organizations implementing both frameworks avoid redundant effort and leverage existing compliance work.`,
    category: 'framework',
    tags: ['NIST', 'ISO 42001', 'framework alignment', 'cross-reference', 'mapping'],
    source: 'GovSecure Framework Analysis',
    sourceType: 'static',
  });

  // EU AI Act ↔ NIST mapping
  entries.push({
    title: 'Framework Alignment — EU AI Act to NIST AI RMF Mapping',
    content: `${FRAMEWORK_ALIGNMENT.euAiActToNist.description}\n\nMappings:\n${FRAMEWORK_ALIGNMENT.euAiActToNist.mappings.map(m => `- ${m.euRequirement} → NIST ${m.nistFunction}\n  ${m.alignment}`).join('\n')}\n\nOrganizations subject to the EU AI Act can use the NIST AI RMF as a practical implementation guide, particularly for high-risk AI system requirements.`,
    category: 'framework',
    tags: ['EU AI Act', 'NIST', 'framework alignment', 'cross-reference', 'compliance'],
    source: 'GovSecure Framework Analysis',
    sourceType: 'static',
  });

  return entries;
}

// ─── Implementation Guidance Entries ─────────────────────────────────────────

function buildImplementationEntries(): SeedEntry[] {
  const entries: SeedEntry[] = [];

  // SMB Roadmap
  const roadmap = IMPLEMENTATION_GUIDANCE.smbRoadmap;
  entries.push({
    title: 'AI Governance Implementation Roadmap for SMBs',
    content: `A practical 12-month roadmap for small and medium businesses to implement AI governance:\n\n${Object.values(roadmap).map((phase: { name: string; activities: string[] }) => `${phase.name}:\n${phase.activities.map(a => `  - ${a}`).join('\n')}`).join('\n\n')}\n\nThis phased approach ensures organizations can build governance capabilities incrementally without overwhelming limited resources.`,
    category: 'best-practice',
    tags: ['SMB', 'implementation', 'roadmap', 'governance', 'phased approach'],
    source: 'GovSecure Implementation Guide',
    sourceType: 'static',
  });

  // Risk Assessment Template
  const rat = IMPLEMENTATION_GUIDANCE.riskAssessmentTemplate;
  entries.push({
    title: 'AI Risk Assessment Template and Methodology',
    content: `Comprehensive AI risk assessment methodology covering 5 risk categories:\n\n${rat.categories.map(c => `${c.name}:\n${c.factors.map(f => `  - ${f}`).join('\n')}`).join('\n\n')}\n\nRisk Scoring Levels:\n${rat.riskLevels.map(l => `- ${l.level} (Score ${l.score}): ${l.action}`).join('\n')}\n\nUse a 5×5 risk matrix (Likelihood × Impact) to score each factor. Prioritize mitigation based on the resulting risk level.`,
    category: 'template',
    tags: ['risk assessment', 'template', 'methodology', 'risk matrix', 'scoring'],
    source: 'GovSecure Risk Assessment Framework',
    sourceType: 'static',
  });

  return entries;
}

// ─── GDPR AI-Specific Entries ────────────────────────────────────────────────

function buildGdprEntries(): SeedEntry[] {
  return [
    {
      title: 'GDPR Article 22 — Automated Individual Decision-Making and Profiling',
      content: `GDPR Article 22 provides that data subjects have the right not to be subject to a decision based solely on automated processing, including profiling, which produces legal effects or similarly significantly affects them.\n\nExceptions (Article 22(2)):\n- Necessary for a contract between the data subject and controller\n- Authorized by EU or Member State law with suitable safeguards\n- Based on explicit consent\n\nSafeguards required (Article 22(3)):\n- Right to obtain human intervention\n- Right to express their point of view\n- Right to contest the decision\n\nFor AI systems, this means:\n- Fully automated hiring decisions require explicit consent or human review\n- Credit scoring that auto-rejects must offer human intervention\n- Profiling for targeted advertising with significant effects needs a lawful basis\n- Meaningful information about logic involved must be provided (Article 13(2)(f) and 14(2)(g))`,
      category: 'regulation',
      tags: ['GDPR', 'Article 22', 'automated decision-making', 'profiling', 'human intervention', 'right to explanation'],
      source: 'General Data Protection Regulation (EU) 2016/679',
      sourceType: 'regulation',
    },
    {
      title: 'GDPR Article 35 — Data Protection Impact Assessment (DPIA) for AI',
      content: `GDPR Article 35 requires a Data Protection Impact Assessment (DPIA) when processing is likely to result in a high risk to the rights and freedoms of natural persons.\n\nDPIA is mandatory when processing involves:\n- Systematic and extensive evaluation of personal aspects (profiling) producing legal effects\n- Large-scale processing of special category data (Article 9) or criminal conviction data (Article 10)\n- Systematic monitoring of publicly accessible areas on a large scale\n\nDPIA must contain:\n- Systematic description of processing operations and purposes\n- Assessment of necessity and proportionality\n- Assessment of risks to rights and freedoms\n- Measures to address risks, including safeguards and security measures\n\nFor AI systems:\n- Machine learning models using personal data for predictions require DPIA\n- Facial recognition and biometric systems always require DPIA\n- AI scoring or ranking of individuals requires DPIA\n- If DPIA indicates high risk remains after mitigation, consult the supervisory authority (Article 36)`,
      category: 'regulation',
      tags: ['GDPR', 'Article 35', 'DPIA', 'data protection', 'impact assessment', 'privacy', 'high risk'],
      source: 'General Data Protection Regulation (EU) 2016/679',
      sourceType: 'regulation',
    },
    {
      title: 'GDPR Article 25 — Data Protection by Design and by Default for AI',
      content: `GDPR Article 25 requires that data protection principles are embedded into the design of processing activities and business practices from the outset.\n\nBy Design:\n- Implement appropriate technical and organizational measures (e.g., pseudonymization, data minimization) at the time of determining processing means and at the time of processing itself\n- Consider state of the art, cost, nature/scope/context/purposes, and risks\n\nBy Default:\n- Only personal data necessary for each specific purpose is processed\n- Applies to amount collected, extent of processing, storage period, and accessibility\n- Personal data not accessible to an indefinite number of persons without individual intervention\n\nFor AI systems:\n- Training data should be minimized and pseudonymized where possible\n- Feature selection should avoid unnecessary personal data fields\n- Model outputs should not expose more personal data than necessary\n- Retention policies must cover training data, inference logs, and model checkpoints\n- Privacy-enhancing technologies (PETs) like differential privacy, federated learning, and synthetic data should be considered`,
      category: 'regulation',
      tags: ['GDPR', 'Article 25', 'privacy by design', 'data minimization', 'pseudonymization', 'AI design'],
      source: 'General Data Protection Regulation (EU) 2016/679',
      sourceType: 'regulation',
    },
    {
      title: 'GDPR Articles 13-14 — Transparency and AI Explainability',
      content: `GDPR Articles 13 and 14 require controllers to provide information about processing at the time personal data is obtained.\n\nFor automated decision-making systems, controllers must provide:\n- The existence of automated decision-making, including profiling (Articles 13(2)(f) and 14(2)(g))\n- Meaningful information about the logic involved\n- The significance and envisaged consequences of such processing\n\nPractical implications for AI transparency:\n- Privacy notices must disclose AI/ML use in decision-making\n- "Meaningful information about logic" means explaining the key factors, not necessarily the full algorithm\n- Users must understand how AI outputs affect them\n- Layered notices can provide both high-level and detailed explanations\n\nRecital 71 guidance:\n- Right to obtain an explanation of the decision reached after automated processing\n- Controller should use appropriate mathematical or statistical procedures\n- Measures should minimize risk of errors and prevent discriminatory effects`,
      category: 'regulation',
      tags: ['GDPR', 'Article 13', 'Article 14', 'transparency', 'explainability', 'AI disclosure', 'privacy notice'],
      source: 'General Data Protection Regulation (EU) 2016/679',
      sourceType: 'regulation',
    },
    {
      title: 'GDPR Article 6 — Lawful Basis for AI Processing',
      content: `GDPR Article 6 establishes the lawful bases for processing personal data. For AI systems, the most relevant bases are:\n\n1. Consent (Article 6(1)(a)):\n   - Must be freely given, specific, informed, and unambiguous\n   - Difficult for complex AI with opaque processing\n   - Can be withdrawn at any time\n\n2. Contractual Necessity (Article 6(1)(b)):\n   - Processing necessary for contract performance\n   - Applies to AI-powered services explicitly agreed to\n\n3. Legitimate Interest (Article 6(1)(f)):\n   - Requires balancing test: legitimate interest vs. rights of data subjects\n   - Most common basis for business AI applications\n   - Must document the Legitimate Interest Assessment (LIA)\n   - Not available for public authorities in performance of tasks\n\n4. Legal Obligation (Article 6(1)(c)):\n   - When AI processing is required by law (e.g., AML transaction monitoring)\n\nKey considerations for AI:\n- Repurposing data for AI training may require a new/different lawful basis\n- Legitimate interest requires regular reassessment\n- Special category data (Article 9) requires explicit consent or specific exemption\n- Children's data requires parental consent and age verification`,
      category: 'regulation',
      tags: ['GDPR', 'Article 6', 'lawful basis', 'consent', 'legitimate interest', 'AI processing', 'legal basis'],
      source: 'General Data Protection Regulation (EU) 2016/679',
      sourceType: 'regulation',
    },
  ];
}

// ─── NIST Playbook Entries (from JSON) ───────────────────────────────────────

async function buildNistPlaybookEntries(): Promise<SeedEntry[]> {
  const { default: playbook } = await import('@/data/nistPlaybook.json') as {
    default: Array<{
      type: string;
      title: string;
      category: string;
      description: string;
      section_about?: string;
      section_actions?: string;
      section_doc?: string;
      section_ref?: string;
    }>;
  };

  return playbook.map(entry => ({
    title: `NIST Playbook — ${entry.title}`,
    content: [
      `NIST AI RMF Playbook — ${entry.type} Function`,
      `Subcategory: ${entry.title} (Category: ${entry.category})`,
      '',
      entry.description,
      entry.section_about ? `\nAbout:\n${entry.section_about}` : '',
      entry.section_actions ? `\nSuggested Actions:\n${entry.section_actions}` : '',
      entry.section_doc ? `\nDocumentation:\n${entry.section_doc}` : '',
      entry.section_ref ? `\nReferences:\n${entry.section_ref}` : '',
    ].filter(Boolean).join('\n'),
    category: 'framework',
    tags: ['NIST', 'AI RMF', 'playbook', entry.type, entry.title, entry.category],
    source: 'NIST AI RMF Playbook',
    sourceType: 'nist',
  }));
}

// ─── Export All Seed Data ────────────────────────────────────────────────────

export async function getAllSeedEntries(): Promise<SeedEntry[]> {
  const nistPlaybookEntries = await buildNistPlaybookEntries();

  const entries = [
    ...buildNistEntries(),
    ...buildEuAiActEntries(),
    ...buildIso42001Entries(),
    ...buildCrossReferenceEntries(),
    ...buildImplementationEntries(),
    ...buildGdprEntries(),
    ...nistPlaybookEntries,
  ];

  return entries;
}

/**
 * Summary of what gets seeded:
 *
 * NIST AI RMF:
 *   - 1 overview entry (framework structure, tiers, characteristics)
 *   - 4 function entries (GOVERN, MAP, MEASURE, MANAGE)
 *   - ~15 category entries (GV-1, GV-2, ..., MG-3 with subcategories)
 *   - 72 playbook entries (detailed subcategory guidance)
 *
 * EU AI Act:
 *   - 1 overview entry (timeline, penalties, governance bodies)
 *   - 1 prohibited practices entry (8 banned AI uses)
 *   - 1 high-risk use cases entry (8 areas)
 *   - 1 high-risk requirements entry (11 requirements)
 *   - 1 limited risk entry (transparency obligations)
 *   - 1 GPAI rules entry (general + systemic risk obligations)
 *
 * ISO 42001:
 *   - 1 overview entry (principles, certification, annexes)
 *   - 10 clause entries (Clauses 1-10 with requirements)
 *
 * GDPR (AI-specific):
 *   - Article 6 (lawful basis for AI)
 *   - Article 13/14 (transparency & explainability)
 *   - Article 22 (automated decision-making)
 *   - Article 25 (privacy by design)
 *   - Article 35 (DPIA for AI)
 *
 * Cross-References:
 *   - NIST ↔ ISO 42001 mapping
 *   - EU AI Act ↔ NIST mapping
 *
 * Implementation:
 *   - SMB 12-month roadmap
 *   - Risk assessment template
 *
 * Total: ~115 entries (vs. 13 previously)
 */