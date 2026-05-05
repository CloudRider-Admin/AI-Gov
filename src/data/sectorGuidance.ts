/**
 * Sector-specific AI governance guidance.
 *
 * Provides domain-tailored risk factors, regulatory requirements,
 * and implementation recommendations for key industries.
 */

export interface SectorGuidance {
  id: string;
  sector: string;
  displayName: string;
  description: string;
  keyRegulations: { name: string; relevance: string }[];
  riskFactors: { factor: string; severity: 'high' | 'medium' | 'low'; description: string }[];
  recommendations: string[];
  frameworkPriorities: { framework: string; focus: string }[];
}

export const SECTOR_GUIDANCE: SectorGuidance[] = [
  {
    id: 'finance',
    sector: 'finance',
    displayName: 'Financial Services',
    description: 'Banking, insurance, lending, investment, and fintech applications of AI.',
    keyRegulations: [
      { name: 'EU AI Act — Annex III §5', relevance: 'AI used for creditworthiness assessment or credit scoring is classified as high-risk' },
      { name: 'ECOA / Regulation B (US)', relevance: 'Prohibits discrimination in credit decisions; AI models must be tested for disparate impact' },
      { name: 'Fair Lending Laws (FCRA, TILA)', relevance: 'Adverse action notices required when AI drives credit denials; model explainability mandatory' },
      { name: 'SR 11-7 (US Fed)', relevance: 'Model risk management guidance — validation, ongoing monitoring, and governance for all models including AI' },
      { name: 'DORA (EU)', relevance: 'Digital Operational Resilience Act requires ICT risk management, incident reporting, and third-party oversight for financial AI' },
      { name: 'MiFID II (EU)', relevance: 'Algorithmic trading systems must have kill switches, circuit breakers, and audit trails' },
      { name: 'Basel III/IV', relevance: 'Operational risk capital requirements apply to AI model failures in credit and market risk' },
    ],
    riskFactors: [
      { factor: 'Credit decision bias', severity: 'high', description: 'AI-driven lending or scoring models may produce disparate impact against protected classes (race, gender, age)' },
      { factor: 'Algorithmic trading risk', severity: 'high', description: 'Automated trading systems can amplify market volatility; flash crash potential' },
      { factor: 'Model explainability', severity: 'high', description: 'Regulators require explanation of AI-driven financial decisions; black-box models face enforcement risk' },
      { factor: 'AML/KYC false positives', severity: 'medium', description: 'AI anti-money laundering systems may over-flag legitimate customers, causing service denial' },
      { factor: 'Fraud detection drift', severity: 'medium', description: 'Fraud patterns evolve; models degrade without continuous retraining and monitoring' },
      { factor: 'Data privacy', severity: 'medium', description: 'Financial data is highly sensitive; cross-border transfer restrictions under GDPR, GLBA, and local laws' },
    ],
    recommendations: [
      'Implement model risk management aligned with SR 11-7: independent validation, ongoing monitoring, and model inventory',
      'Conduct disparate impact testing on all credit and lending AI before deployment',
      'Maintain adverse action notice capability for all consumer-facing AI decisions',
      'Establish kill switches and circuit breakers for algorithmic trading systems',
      'Document model lineage, training data provenance, and feature importance for regulatory examination',
      'Run stress tests and scenario analysis on AI models quarterly',
      'Ensure AML/KYC models are tuned to minimize false positive rates while maintaining detection',
    ],
    frameworkPriorities: [
      { framework: 'NIST AI RMF', focus: 'MEASURE functions — quantitative bias testing, performance metrics, and model validation' },
      { framework: 'EU AI Act', focus: 'High-risk compliance for credit scoring (Annex III §5) — DPIA, human oversight, conformity assessment' },
      { framework: 'ISO 42001', focus: 'Clause 8 (Operation) — model lifecycle management and third-party model governance' },
    ],
  },
  {
    id: 'healthcare',
    sector: 'healthcare',
    displayName: 'Healthcare & Life Sciences',
    description: 'Clinical decision support, diagnostics, drug discovery, patient management, and health insurance AI.',
    keyRegulations: [
      { name: 'EU AI Act — Annex III §5', relevance: 'AI intended to evaluate eligibility for health insurance or public health benefits is classified as high-risk' },
      { name: 'HIPAA (US)', relevance: 'Protected Health Information (PHI) requires safeguards; AI processing PHI must meet Security Rule requirements' },
      { name: 'FDA SaMD Guidance (US)', relevance: 'Software as a Medical Device — AI/ML-based devices require premarket review and Good Machine Learning Practice' },
      { name: 'MDR / IVDR (EU)', relevance: 'Medical Device Regulation classifies AI-driven diagnostic tools; requires conformity assessment and CE marking' },
      { name: 'GDPR Article 9', relevance: 'Health data is a special category; explicit consent or specific legal basis required for processing' },
      { name: 'Clinical Trials Regulation (EU)', relevance: 'AI used in clinical trial design or patient selection must comply with CTR 536/2014' },
      { name: 'HITECH Act (US)', relevance: 'Strengthens HIPAA enforcement for electronic health records and AI systems processing EHR data' },
    ],
    riskFactors: [
      { factor: 'Patient safety', severity: 'high', description: 'Incorrect AI diagnoses or treatment recommendations can directly harm patients' },
      { factor: 'PHI/health data sensitivity', severity: 'high', description: 'Health data is among the most sensitive categories; breaches have severe legal and reputational consequences' },
      { factor: 'Clinical validation', severity: 'high', description: 'AI diagnostic tools require clinical validation equivalent to traditional medical devices' },
      { factor: 'Health equity and bias', severity: 'high', description: 'AI trained on non-representative data may perform poorly for underserved populations' },
      { factor: 'Regulatory classification uncertainty', severity: 'medium', description: 'Distinction between clinical decision support and medical device AI is evolving' },
      { factor: 'Interoperability', severity: 'medium', description: 'AI must integrate with EHR systems (HL7 FHIR) without data corruption or loss' },
    ],
    recommendations: [
      'Determine FDA/MDR regulatory classification early — clinical decision support vs. Software as a Medical Device',
      'Conduct clinical validation studies with diverse patient populations before deployment',
      'Implement PHI de-identification or pseudonymization for AI training data (Safe Harbor or Expert Determination)',
      'Establish clinical oversight committee with physician representation for AI-assisted diagnoses',
      'Test AI models for health equity across race, gender, age, and socioeconomic status',
      'Maintain complete audit trails for all AI-assisted clinical decisions',
      'Ensure HIPAA Business Associate Agreements cover AI vendor data handling',
      'Implement fail-safe mechanisms: AI recommendations must be reviewable before clinical action',
    ],
    frameworkPriorities: [
      { framework: 'NIST AI RMF', focus: 'MAP functions — risk identification for patient safety, GOVERN for clinical oversight structures' },
      { framework: 'EU AI Act', focus: 'High-risk requirements for health insurance AI; MDR alignment for diagnostic tools' },
      { framework: 'ISO 42001', focus: 'Clause 6 (Planning) — AI-specific risk assessment and impact assessment for patient-facing systems' },
    ],
  },
  {
    id: 'government',
    sector: 'government',
    displayName: 'Government & Public Sector',
    description: 'Public administration, benefits, law enforcement, defense, and civic technology AI applications.',
    keyRegulations: [
      { name: 'EU AI Act — Annex III §6-8', relevance: 'AI in law enforcement, migration, and justice administration classified as high-risk; social scoring by public authorities prohibited' },
      { name: 'US Executive Order 14110', relevance: 'Safe, Secure, and Trustworthy AI — mandates AI risk management, red-teaming, and equity testing for federal AI' },
      { name: 'OMB Memorandum M-24-10', relevance: 'Advancing Governance, Innovation, and Risk Management for Agency Use of AI — requires AI governance boards, impact assessments, and public transparency' },
      { name: 'AI Bill of Rights (US)', relevance: 'Non-binding blueprint: safe systems, algorithmic discrimination protection, data privacy, notice, human alternatives' },
      { name: 'Federal Acquisition Regulation (FAR)', relevance: 'AI procurement requirements for government contractors; supply chain risk management' },
      { name: 'FISMA (US)', relevance: 'Federal Information Security Management Act applies to AI systems processing government data' },
      { name: 'Freedom of Information laws', relevance: 'Government AI decisions may be subject to FOIA requests; algorithmic transparency requirements' },
    ],
    riskFactors: [
      { factor: 'Civil rights impact', severity: 'high', description: 'Government AI decisions on benefits, policing, or immigration directly affect civil rights and liberties' },
      { factor: 'Algorithmic accountability', severity: 'high', description: 'Public sector AI must be explainable and contestable; citizens have due process rights' },
      { factor: 'Social scoring prohibition', severity: 'high', description: 'EU AI Act explicitly prohibits government social scoring systems' },
      { factor: 'Surveillance and biometrics', severity: 'high', description: 'Real-time biometric identification in public spaces is restricted or prohibited' },
      { factor: 'Procurement risk', severity: 'medium', description: 'Government AI procurement must ensure vendor compliance, data sovereignty, and audit rights' },
      { factor: 'Digital divide', severity: 'medium', description: 'AI-driven public services must remain accessible to populations without digital access' },
    ],
    recommendations: [
      'Establish an AI governance board with cross-functional representation (legal, ethics, IT, operations)',
      'Conduct algorithmic impact assessments before deploying AI in benefits determination or law enforcement',
      'Ensure human-in-the-loop for all consequential decisions affecting individual rights',
      'Publish transparency reports on AI systems used in public-facing decisions',
      'Implement bias testing with demographic parity metrics relevant to the served population',
      'Maintain opt-out and human alternative pathways for all AI-driven public services',
      'Comply with OMB M-24-10 requirements: AI use case inventory, risk categorization, and public reporting',
      'Ensure AI procurement contracts include audit rights, data sovereignty clauses, and incident notification',
    ],
    frameworkPriorities: [
      { framework: 'NIST AI RMF', focus: 'GOVERN functions — organizational accountability, transparency, and third-party oversight' },
      { framework: 'EU AI Act', focus: 'Prohibited practices (social scoring), high-risk compliance for law enforcement and benefits AI' },
      { framework: 'ISO 42001', focus: 'Clause 5 (Leadership) — top management commitment and public accountability structures' },
    ],
  },
];

/**
 * Find sector guidance matching the user's query.
 * Returns all matching sectors sorted by relevance.
 */
export function matchSectors(query: string): SectorGuidance[] {
  const q = query.toLowerCase();

  const SECTOR_KEYWORDS: Record<string, string[]> = {
    finance: ['bank', 'banking', 'fintech', 'lending', 'credit', 'loan', 'insurance', 'trading', 'invest', 'payment', 'aml', 'kyc', 'fraud', 'underwriting', 'mortgage', 'financial'],
    healthcare: ['health', 'medical', 'clinical', 'patient', 'hospital', 'diagnos', 'pharma', 'drug', 'ehr', 'hipaa', 'fda', 'therapeutic', 'nursing', 'radiology', 'pathology'],
    government: ['government', 'federal', 'agency', 'public sector', 'law enforcement', 'police', 'immigration', 'benefits', 'social services', 'defense', 'military', 'civic', 'municipal'],
  };

  return SECTOR_GUIDANCE
    .map(sector => {
      const keywords = SECTOR_KEYWORDS[sector.id] ?? [];
      const score = keywords.reduce((acc, kw) => acc + (q.includes(kw) ? 1 : 0), 0);
      return { sector, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ sector }) => sector);
}