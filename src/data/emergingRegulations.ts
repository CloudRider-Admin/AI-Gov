/**
 * Emerging AI regulations beyond EU AI Act, GDPR, and NIST AI RMF.
 *
 * These are newer or in-progress regulations that organizations should
 * monitor and prepare for. Each entry includes status, key provisions,
 * and actionable compliance steps.
 */

export interface EmergingRegulation {
  id: string;
  name: string;
  shortName: string;
  jurisdiction: string;
  status: 'enacted' | 'in-force' | 'proposed' | 'final-rule';
  effectiveDate?: string;
  summary: string;
  keyProvisions: { provision: string; description: string }[];
  affectedSectors: string[];
  complianceActions: string[];
  penaltyRange?: string;
  relatedFrameworks: string[];
}

export const EMERGING_REGULATIONS: EmergingRegulation[] = [
  {
    id: 'us-eo-14110',
    name: 'Executive Order 14110 — Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence',
    shortName: 'US EO 14110',
    jurisdiction: 'United States (Federal)',
    status: 'in-force',
    effectiveDate: '2023-10-30',
    summary: 'Comprehensive executive order directing federal agencies to manage AI risks, promote innovation, and protect civil rights. Requires safety testing, red-teaming, and reporting for dual-use foundation models. Directs NIST to develop AI safety guidelines and OMB to issue government-wide AI governance policy.',
    keyProvisions: [
      { provision: 'Dual-use foundation model reporting', description: 'Developers of powerful AI models must report safety test results to the federal government before public release' },
      { provision: 'Red-teaming requirements', description: 'Federal agencies must conduct AI red-teaming and adversarial testing before deploying AI systems' },
      { provision: 'NIST AI safety standards', description: 'Directs NIST to develop standards and best practices for AI safety, including red-team testing frameworks' },
      { provision: 'Federal AI governance (OMB M-24-10)', description: 'Agencies must designate Chief AI Officers, maintain AI use case inventories, and conduct impact assessments' },
      { provision: 'AI and civil rights', description: 'Agencies must address algorithmic discrimination and ensure AI does not advance unlawful bias' },
      { provision: 'AI workforce', description: 'Agencies directed to attract AI talent and train existing workforce on responsible AI' },
      { provision: 'AI in critical infrastructure', description: 'DHS to assess AI risks to critical infrastructure sectors and develop sector-specific guidelines' },
    ],
    affectedSectors: ['government', 'defense', 'critical infrastructure', 'healthcare', 'finance', 'technology'],
    complianceActions: [
      'Monitor NIST AI safety standards and integrate into your risk management framework',
      'If developing foundation models: prepare for reporting and safety testing requirements',
      'Federal contractors: comply with OMB M-24-10 AI governance requirements',
      'Conduct AI red-teaming aligned with NIST guidelines',
      'Document AI use cases and maintain an inventory',
      'Assess AI systems for civil rights and equity impacts',
    ],
    relatedFrameworks: ['NIST AI RMF', 'NIST AI 100-1', 'OMB M-24-10'],
  },
  {
    id: 'colorado-ai-act',
    name: 'Colorado AI Act (SB 24-205)',
    shortName: 'Colorado AI Act',
    jurisdiction: 'United States (Colorado)',
    status: 'enacted',
    effectiveDate: '2026-02-01',
    summary: 'First comprehensive US state AI law. Requires developers and deployers of "high-risk AI systems" to exercise reasonable care to avoid algorithmic discrimination. Mandates risk management, impact assessments, transparency, and consumer notification for AI used in consequential decisions.',
    keyProvisions: [
      { provision: 'High-risk AI system definition', description: 'AI that is a substantial factor in consequential decisions about education, employment, financial services, healthcare, housing, insurance, or legal services' },
      { provision: 'Developer duties of care', description: 'AI developers must provide documentation on training data, known limitations, intended uses, and risk mitigation guidance' },
      { provision: 'Deployer risk management', description: 'Organizations using high-risk AI must implement a risk management policy, conduct impact assessments, and review AI systems annually' },
      { provision: 'Algorithmic discrimination prevention', description: 'Both developers and deployers must take reasonable steps to prevent AI from producing discriminatory outcomes based on protected classes' },
      { provision: 'Consumer transparency', description: 'Consumers must be notified when AI is used in consequential decisions, told how to contest the decision, and informed if the decision was adverse' },
      { provision: 'Impact assessment requirement', description: 'Deployers must complete impact assessments evaluating purpose, intended uses, risks, data requirements, and mitigation measures' },
      { provision: 'AG enforcement', description: 'Colorado Attorney General has exclusive enforcement authority; compliance is an affirmative defense' },
    ],
    affectedSectors: ['finance', 'healthcare', 'insurance', 'employment', 'housing', 'education', 'legal services'],
    complianceActions: [
      'Inventory all AI systems making consequential decisions in covered domains',
      'Implement a risk management policy and program for high-risk AI systems',
      'Conduct and document annual impact assessments for high-risk AI',
      'Test AI systems for algorithmic discrimination across protected classes',
      'Provide consumer notice and explanation when AI drives consequential decisions',
      'Obtain developer documentation on training data, limitations, and intended uses',
      'Establish an appeals/contestation process for AI-driven adverse decisions',
    ],
    penaltyRange: 'Up to $20,000 per violation under Colorado Consumer Protection Act; AG enforcement only',
    relatedFrameworks: ['NIST AI RMF', 'ISO 42001'],
  },
  {
    id: 'canada-aida',
    name: 'Artificial Intelligence and Data Act (AIDA)',
    shortName: 'Canada AIDA',
    jurisdiction: 'Canada (Federal)',
    status: 'proposed',
    summary: 'Part 3 of Bill C-27 (Digital Charter Implementation Act). Proposes a regulatory framework for AI in Canada covering high-impact AI systems. Requires impact assessments, risk mitigation, transparency, and establishes a new AI and Data Commissioner. Currently paused in parliamentary process.',
    keyProvisions: [
      { provision: 'High-impact AI systems', description: 'Systems that may affect health, safety, human rights, or financial interests — specific criteria to be defined by regulation' },
      { provision: 'Impact assessments', description: 'Operators of high-impact AI must assess and mitigate risks of harm, bias, and adverse impacts before deployment' },
      { provision: 'Transparency obligations', description: 'Must publish plain-language descriptions of AI systems, their purpose, and potential risks' },
      { provision: 'AI and Data Commissioner', description: 'New federal role to oversee AI regulation, conduct audits, and enforce compliance' },
      { provision: 'Prohibition on harmful AI', description: 'Criminal offense to deploy AI that causes serious harm through reckless or willful conduct' },
      { provision: 'General-purpose AI provisions', description: 'Framework for regulating foundation models and general-purpose AI systems' },
      { provision: 'Anonymized data framework', description: 'Establishes rules for anonymization standards used in AI training' },
    ],
    affectedSectors: ['all sectors operating in Canada'],
    complianceActions: [
      'Monitor AIDA progress — bill may be reintroduced or modified in future parliamentary session',
      'Inventory AI systems that could qualify as high-impact under likely criteria',
      'Begin conducting voluntary impact assessments aligned with ISO 42001 and NIST AI RMF',
      'Prepare transparency documentation for customer-facing AI systems',
      'Review anonymization practices for AI training data against emerging Canadian standards',
      'Engage with Innovation, Science and Economic Development Canada (ISED) consultations',
    ],
    relatedFrameworks: ['NIST AI RMF', 'ISO 42001', 'EU AI Act'],
  },
  {
    id: 'eu-ai-liability',
    name: 'EU AI Liability Directive (Proposed)',
    shortName: 'EU AI Liability Directive',
    jurisdiction: 'European Union',
    status: 'proposed',
    summary: 'Proposed directive to adapt civil liability rules for AI. Introduces rebuttable presumption of causality for AI-caused harm and right of access to evidence from AI operators. Complements the EU AI Act by addressing damages and compensation.',
    keyProvisions: [
      { provision: 'Rebuttable presumption of causality', description: 'If claimant shows AI non-compliance and link to harm, fault and causation are presumed — burden shifts to defendant' },
      { provision: 'Disclosure of evidence', description: 'Courts can order AI operators to disclose evidence about high-risk AI systems relevant to the claim' },
      { provision: 'Lowered burden of proof', description: 'Claimants do not need to explain AI internals; showing non-compliance with EU AI Act suffices' },
      { provision: 'Applies to all AI systems', description: 'Not limited to high-risk — any AI system causing harm covered, with stronger presumptions for high-risk' },
    ],
    affectedSectors: ['all sectors deploying AI in the EU'],
    complianceActions: [
      'Maintain detailed logs and documentation of AI system compliance with EU AI Act',
      'Implement robust incident recording to defend against liability claims',
      'Review insurance coverage for AI-related liability',
      'Ensure AI systems have clear audit trails that can be disclosed if ordered',
    ],
    relatedFrameworks: ['EU AI Act', 'EU Product Liability Directive'],
  },
  {
    id: 'nyc-ll-144',
    name: 'New York City Local Law 144 — Automated Employment Decision Tools',
    shortName: 'NYC LL 144',
    jurisdiction: 'United States (New York City)',
    status: 'in-force',
    effectiveDate: '2023-07-05',
    summary: 'Requires employers using automated employment decision tools (AEDTs) for hiring or promotion in NYC to conduct annual independent bias audits and provide notice to candidates. First US law specifically regulating AI in employment decisions.',
    keyProvisions: [
      { provision: 'Bias audit requirement', description: 'Annual independent audit calculating selection/scoring rates and impact ratios by sex, race/ethnicity, and intersectional categories' },
      { provision: 'Public audit results', description: 'Audit summary must be published on employer website for at least 6 months' },
      { provision: 'Candidate notice', description: 'Candidates must be notified at least 10 business days before AEDT use, told which qualifications/characteristics are assessed' },
      { provision: 'Data collection notice', description: 'Candidates informed what data is collected and can request an alternative selection process' },
    ],
    affectedSectors: ['employment', 'HR technology', 'recruiting'],
    complianceActions: [
      'Determine if your hiring tools meet the AEDT definition under LL 144',
      'Commission annual independent bias audits from qualified auditors',
      'Publish audit results on your website and maintain for 6+ months',
      'Update candidate communications with AEDT notice and data collection disclosures',
      'Offer alternative evaluation processes for candidates who request them',
    ],
    penaltyRange: '$500 for first violation; $500–$1,500 per subsequent violation per day',
    relatedFrameworks: ['NIST AI RMF', 'EEOC Guidance'],
  },
];

/**
 * Find regulations relevant to a query based on keyword matching.
 */
export function matchRegulations(query: string, limit = 3): EmergingRegulation[] {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 2);

  return EMERGING_REGULATIONS
    .map(reg => {
      let score = 0;
      const searchText = `${reg.name} ${reg.shortName} ${reg.summary} ${reg.jurisdiction} ${reg.affectedSectors.join(' ')} ${reg.keyProvisions.map(p => p.description).join(' ')}`.toLowerCase();

      for (const term of terms) {
        if (searchText.includes(term)) score++;
      }

      // Boost for exact short name match
      if (q.includes(reg.shortName.toLowerCase())) score += 5;
      if (q.includes(reg.id.replace(/-/g, ' '))) score += 3;

      return { reg, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ reg }) => reg);
}
