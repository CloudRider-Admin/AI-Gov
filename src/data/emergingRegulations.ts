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

  // ── US financial-services regs (added so financial-sector intakes don't
  //     surface GDPR / EU AI Act ahead of the rules that actually apply) ──
  {
    id: 'us-glba',
    name: 'Gramm-Leach-Bliley Act (Safeguards Rule + Privacy Rule)',
    shortName: 'GLBA',
    jurisdiction: 'United States (Federal)',
    status: 'in-force',
    effectiveDate: '1999-11-12',
    summary: 'Federal law governing the protection of nonpublic personal information (NPI) by US financial institutions. The Safeguards Rule (16 CFR 314, updated 2023) requires a written information security program, encryption, MFA, monitoring, incident response, and oversight of service providers — directly applicable to AI systems that ingest, process, or generate decisions on consumer financial data.',
    keyProvisions: [
      { provision: 'Written information security program', description: 'Designate a qualified individual; written program proportionate to size and complexity covering risk assessment, access controls, encryption, change management, incident response, and oversight of service providers' },
      { provision: 'Encryption of NPI at rest and in transit', description: 'AI systems that store or transmit consumer financial data must encrypt it; key management governed under the program' },
      { provision: 'Multi-factor authentication', description: 'Required for any individual accessing customer information — applies to AI tooling, dashboards, and admin interfaces' },
      { provision: 'Service-provider oversight', description: 'Periodic assessment of vendors (including AI/ML providers) and contractual safeguards over NPI' },
      { provision: 'Incident notification (Safeguards Rule, 2023 update)', description: 'Notify FTC within 30 days of a security event affecting 500+ consumers' },
      { provision: 'Privacy Rule notices and opt-out', description: 'Annual privacy notice to consumers; opt-out for sharing NPI with non-affiliates' },
    ],
    affectedSectors: ['finance', 'banking', 'insurance', 'fintech', 'lending', 'broker-dealer', 'investment advisory'],
    complianceActions: [
      'Designate a qualified individual responsible for the information security program covering AI systems',
      'Map AI systems that ingest or output NPI; apply encryption, MFA, and access controls',
      'Add AI/ML vendors (OpenAI, Anthropic, hosting providers) to the service-provider oversight program',
      'Update incident-response runbooks to include AI failure modes and the 30-day FTC notification trigger',
      'Issue annual privacy notices reflecting AI use of consumer financial data',
    ],
    penaltyRange: 'FTC enforcement; civil penalties up to $100,000 per violation, $10,000 per officer/director',
    relatedFrameworks: ['NIST AI RMF', 'NIST CSF', 'ISO 27001'],
  },
  {
    id: 'us-sec-finra-robo',
    name: 'SEC / FINRA Guidance on Robo-Advisers and AI-Driven Recommendations',
    shortName: 'SEC/FINRA Robo-Advice',
    jurisdiction: 'United States (Federal)',
    status: 'in-force',
    effectiveDate: '2017-02-01',
    summary: 'SEC IM Guidance Update 2017-02 plus Reg BI (2020) and the 2023 SEC proposed rule on conflicts of interest in predictive data analytics. Brings AI/ML investment-recommendation tools under existing fiduciary, suitability, and disclosure rules. Any AI system that nudges, recommends, or selects investments for retail clients triggers Adviser Act / Reg BI obligations.',
    keyProvisions: [
      { provision: 'Fiduciary duty (Investment Advisers Act §206)', description: 'Robo-advisers are advisers — duty of care and loyalty applies regardless of automation' },
      { provision: 'Reg BI (broker-dealers)', description: 'Recommendations to retail customers must be in their best interest; AI-generated recommendations included' },
      { provision: 'Suitability and Form ADV disclosure', description: 'Adviser must disclose material facts about the AI methodology, limitations, and conflicts in Form ADV Part 2A' },
      { provision: 'Conflicts in predictive data analytics (2023 proposal)', description: 'Proposed rule would require firms to eliminate or neutralize conflicts where AI/predictive analytics place firm interest ahead of investor' },
      { provision: 'Books and records', description: 'AI model versions, inputs, outputs, and overrides must be retained per Adviser Act Rule 204-2' },
    ],
    affectedSectors: ['finance', 'investment advisory', 'broker-dealer', 'wealth management', 'fintech'],
    complianceActions: [
      'Determine whether the AI tool issues recommendations — if yes, treat as adviser/BD activity',
      'Update Form ADV Part 2A to disclose AI methodology, data sources, limitations, and human oversight',
      'Implement model-version logging and retain inputs/outputs/overrides for 5 years',
      'Map conflicts created by AI ranking/selection logic and document mitigation',
      'Train associated persons on AI tool limits and required client disclosures',
    ],
    relatedFrameworks: ['SR 11-7', 'NIST AI RMF', 'FINRA Reg Notice 21-29'],
  },
  {
    id: 'us-cfpb-udaap',
    name: 'CFPB UDAAP and Adverse Action Guidance for AI-Driven Consumer Decisions',
    shortName: 'CFPB UDAAP / Adverse Action',
    jurisdiction: 'United States (Federal)',
    status: 'in-force',
    effectiveDate: '2022-05-26',
    summary: 'CFPB Circular 2022-03 and follow-on guidance confirming that creditors using AI/ML must provide specific, accurate adverse-action reasons under ECOA / Regulation B even when the underlying model is a "black box". UDAAP authority extends to chatbots, AI customer-service agents, and AI-driven product recommendations that are deceptive or abusive.',
    keyProvisions: [
      { provision: 'Adverse action notice specificity', description: 'Generic reasons are insufficient — creditor must explain the specific, principal reasons for denial, even when using complex models' },
      { provision: 'No "black-box defense"', description: 'Creditor cannot avoid disclosure by claiming model opacity — duty to provide explanation lies with the creditor, not the model vendor' },
      { provision: 'Chatbot UDAAP risk', description: '2023 CFPB report identified chatbot deficiencies (inaccurate info, doom loops, lack of escalation) as potential UDAAP violations' },
      { provision: 'Disparate-impact testing', description: 'Use of AI/ML in credit decisions must be tested for disparate impact under ECOA' },
    ],
    affectedSectors: ['finance', 'consumer lending', 'fintech', 'credit', 'banking', 'consumer financial services'],
    complianceActions: [
      'Audit AI-driven credit decisions to ensure adverse-action notices cite specific principal reasons',
      'Document feature attribution / explanation methodology for each model in production',
      'Map all consumer-facing chatbots and define escalation, accuracy SLAs, and incident criteria',
      'Run annual disparate-impact testing on credit and pricing models',
      'Keep records of model versions, training data, and override decisions for CFPB examination',
    ],
    relatedFrameworks: ['ECOA / Regulation B', 'FCRA', 'Dodd-Frank §1031/1036'],
  },
  {
    id: 'us-nydfs-500',
    name: 'NYDFS Cybersecurity Regulation Part 500 (incl. 2023 Second Amendment)',
    shortName: 'NYDFS Part 500',
    jurisdiction: 'United States (New York State)',
    status: 'in-force',
    effectiveDate: '2017-03-01',
    summary: 'New York Department of Financial Services cybersecurity regulation applicable to all NYDFS-licensed entities (banks, insurers, money transmitters, virtual currency businesses, mortgage lenders). Second Amendment (effective Nov 2023) adds governance, MFA, encryption, vulnerability management, and 72-hour incident notification — covers AI systems that touch customer data or critical operations.',
    keyProvisions: [
      { provision: 'CISO accountability and board oversight', description: 'CISO must report to the board annually; senior officer certification of compliance' },
      { provision: 'Risk assessment & third-party policy', description: 'Annual risk assessment and written policy for third-party service providers — includes AI/ML vendors and hosting providers' },
      { provision: 'MFA and encryption', description: 'MFA for any individual accessing internal networks from external; encryption of NPI in transit and at rest' },
      { provision: '72-hour incident notification', description: 'Cybersecurity events must be reported to NYDFS within 72 hours' },
      { provision: 'Vulnerability management', description: 'Documented program for identifying and remediating vulnerabilities — applies to AI infrastructure and dependencies' },
    ],
    affectedSectors: ['finance', 'banking', 'insurance', 'fintech', 'mortgage', 'virtual currency'],
    complianceActions: [
      'Inventory AI systems handling NPI; ensure MFA, encryption, and access logging are in place',
      'Add AI/ML vendors to the third-party service-provider oversight policy',
      'Update incident-response runbooks for the 72-hour notification window covering AI failures',
      'Include AI components in annual risk assessment and senior-officer certification scope',
    ],
    relatedFrameworks: ['NIST CSF', 'NIST AI RMF', 'GLBA Safeguards Rule'],
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

/**
 * EU/EEA jurisdiction codes — used to gate GDPR / EU AI Act suggestions.
 * If a sector is financial-services and the user has NOT stated EU/EEA
 * operations, GDPR shouldn't crowd out GLBA / SEC / FINRA / CFPB.
 */
const EU_JURISDICTIONS = new Set([
  'EU', 'EEA', 'UK',
  'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'BE', 'AT', 'PT', 'PL', 'SE', 'DK', 'FI', 'NO', 'CZ', 'GR', 'HU', 'RO',
]);
const US_JURISDICTIONS = new Set([
  'US', 'US-CA', 'US-NY', 'US-TX', 'US-IL', 'US-WA', 'US-MA', 'US-FL', 'US-CO',
]);

/**
 * Hint mapping: which regulation ids are most relevant per sector. The
 * order encodes priority (higher first). Used by `rankRegulationsForContext`
 * to push the right regs to the top instead of relying on keyword chance.
 */
const SECTOR_REG_HINTS: Record<string, string[]> = {
  finance: ['us-glba', 'us-cfpb-udaap', 'us-sec-finra-robo', 'us-nydfs-500', 'colorado-ai-act'],
  banking: ['us-glba', 'us-cfpb-udaap', 'us-nydfs-500'],
  insurance: ['us-glba', 'us-nydfs-500', 'colorado-ai-act'],
  fintech: ['us-glba', 'us-cfpb-udaap', 'us-sec-finra-robo'],
  healthcare: [],
  staffing: ['nyc-ll-144'],
  employment: ['nyc-ll-144', 'colorado-ai-act'],
  government: ['us-eo-14110'],
};

export interface RegulationRankingContext {
  /** Free-text query (use case description). */
  query?: string;
  /** Industry label, e.g. 'finance', 'healthcare'. */
  industry?: string;
  /** ISO-style jurisdiction codes — 'US', 'EU', 'US-CA', etc. */
  jurisdictions?: string[];
  /** Public/customer-facing flag — boosts consumer-protection regs. */
  customerFacing?: boolean;
}

/**
 * Rank regulations using sector hints + jurisdiction filters + optional
 * keyword fallback. Hides EU regs when no EU jurisdiction was supplied;
 * hides US regs when only EU was supplied.
 *
 * Use this from intake-orchestration paths instead of `matchRegulations`
 * when you have structured context. Plain RAG keeps using `matchRegulations`.
 */
export function rankRegulationsForContext(
  ctx: RegulationRankingContext,
  limit = 4,
): EmergingRegulation[] {
  const jset = new Set((ctx.jurisdictions ?? []).map(j => j.toUpperCase()));
  const hasEU = Array.from(jset).some(j => EU_JURISDICTIONS.has(j));
  const hasUS = Array.from(jset).some(j => US_JURISDICTIONS.has(j));
  const noJurisdiction = jset.size === 0;

  const scored = EMERGING_REGULATIONS.map(reg => {
    let score = 0;

    // Sector hint — high boost, ordered
    const hints = (ctx.industry && SECTOR_REG_HINTS[ctx.industry.toLowerCase()]) || [];
    const hintIdx = hints.indexOf(reg.id);
    if (hintIdx >= 0) score += 100 - hintIdx * 5;

    // Jurisdiction filter — exclude regs whose jurisdiction the user
    // didn't claim. Skip filtering when the user gave none (so we don't
    // hide everything). Federal-EU regs only when user said EU; federal-US
    // regs only when user said US (state regs follow state codes).
    const isEUReg = /european union|^eu\b/i.test(reg.jurisdiction);
    const isUSFederalReg = /^united states \(federal\)/i.test(reg.jurisdiction);
    const isUSStateReg = /united states \([A-Za-z][^)]*\)/i.test(reg.jurisdiction) && !isUSFederalReg;
    if (!noJurisdiction) {
      if (isEUReg && !hasEU) score -= 200;
      if (isUSFederalReg && !hasUS) score -= 50;
      if (isUSStateReg) {
        const stateMatch = reg.jurisdiction.match(/\(([^)]+)\)/);
        const stateName = stateMatch?.[1]?.toLowerCase() ?? '';
        const userClaimedThisState = Array.from(jset).some(j => stateName.includes(j.replace('US-', '').toLowerCase()));
        if (!userClaimedThisState) score -= 75;
      }
    }

    // Customer-facing boost for consumer-protection regs
    if (ctx.customerFacing) {
      if (reg.id === 'us-cfpb-udaap' || reg.id === 'colorado-ai-act' || reg.id === 'nyc-ll-144') score += 25;
    }

    // Keyword fallback
    if (ctx.query) {
      const q = ctx.query.toLowerCase();
      const searchText = `${reg.name} ${reg.shortName} ${reg.summary} ${reg.affectedSectors.join(' ')}`.toLowerCase();
      for (const term of q.split(/\s+/).filter(t => t.length > 3)) {
        if (searchText.includes(term)) score += 1;
      }
      if (q.includes(reg.shortName.toLowerCase())) score += 10;
    }

    return { reg, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ reg }) => reg);
}