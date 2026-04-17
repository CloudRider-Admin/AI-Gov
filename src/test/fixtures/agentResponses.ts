/**
 * Deterministic mock responses for multi-agent tests.
 * These simulate what OpenAI returns for each specialist agent.
 */

export const MOCK_RISK_ASSESSOR_RESPONSE = {
  content:
    'This AI hiring tool presents significant risks due to automated decision-making about employment eligibility. The system processes sensitive personal data and directly influences consequential outcomes for candidates.',
  confidence: 0.88,
  riskLevel: 'high' as const,
  reasoning: [
    'Automated employment decisions are high-stakes under EU AI Act Annex III',
    'Processing sensitive personal data including demographic information',
    'Limited human oversight in the screening pipeline',
  ],
  recommendations: [
    'Implement mandatory human review for all rejection decisions',
    'Conduct bias audit across protected characteristics',
    'Deploy monitoring for disparate impact metrics',
  ],
};

export const MOCK_COMPLIANCE_RESPONSE = {
  content:
    'This use case falls under EU AI Act high-risk classification (Annex III, employment domain). GDPR Article 22 applies to automated decision-making. A DPIA is mandatory under GDPR Article 35.',
  confidence: 0.92,
  riskLevel: 'high' as const,
  reasoning: [
    'EU AI Act Annex III explicitly lists employment AI as high-risk',
    'GDPR Article 22 requires safeguards for automated decisions',
    'Article 35 DPIA is mandatory for systematic processing of sensitive data',
  ],
  recommendations: [
    'Complete EU AI Act conformity assessment before deployment',
    'File DPIA with data protection authority',
    'Implement Article 22 safeguards: human intervention, right to contest',
  ],
};

export const MOCK_POLICY_ARCHITECT_RESPONSE = {
  content:
    'The organisation needs a comprehensive AI governance framework covering this high-risk employment use case. Key policies should address human oversight, bias monitoring, and incident response.',
  confidence: 0.82,
  riskLevel: 'high' as const,
  reasoning: [
    'No existing governance framework for AI hiring tools',
    'Multiple regulatory obligations require documented policies',
    'ISO 42001 Clause 5.2 mandates an AI policy',
  ],
  recommendations: [
    'Establish AI Ethics Committee with hiring domain expertise',
    'Create Human Oversight Policy per ISO 42001 Clause 8.6',
    'Implement bias monitoring and reporting cadence',
  ],
};

export const MOCK_IMPLEMENTATION_RESPONSE = {
  content:
    'A phased implementation over 8-10 weeks is recommended. Phase 1 focuses on governance setup, Phase 2 on technical controls, Phase 3 on monitoring and audit readiness.',
  confidence: 0.78,
  riskLevel: 'medium' as const,
  reasoning: [
    'SMB resource constraints require phased approach',
    'Technical controls can be layered incrementally',
    'Audit readiness should precede go-live by at least 2 weeks',
  ],
  recommendations: [
    'Allocate dedicated governance lead (0.5 FTE minimum)',
    'Procure bias testing tool before Phase 2',
    'Schedule internal audit 2 weeks before go-live',
  ],
};

/** Scenario where all agents agree on LOW risk */
export const MOCK_LOW_RISK_RESPONSES = {
  riskAssessor: {
    ...MOCK_RISK_ASSESSOR_RESPONSE,
    content: 'This internal summarisation tool presents minimal risk. It processes only internal documents with no personal data.',
    confidence: 0.91,
    riskLevel: 'low' as const,
    reasoning: ['No personal data processed', 'Internal use only', 'Human reviews all outputs'],
    recommendations: ['Document acceptable use policy', 'Annual review cycle'],
  },
  compliance: {
    ...MOCK_COMPLIANCE_RESPONSE,
    content: 'Minimal regulatory exposure. Standard GDPR compliance sufficient.',
    confidence: 0.94,
    riskLevel: 'low' as const,
    reasoning: ['No high-risk processing', 'Internal tool only', 'No automated decision-making'],
    recommendations: ['Standard data protection measures', 'Record of processing activities'],
  },
  policyArchitect: {
    ...MOCK_POLICY_ARCHITECT_RESPONSE,
    content: 'A lightweight AI acceptable use policy is sufficient for this use case.',
    confidence: 0.87,
    riskLevel: 'low' as const,
    reasoning: ['Low-risk profile', 'Existing IT policies cover most requirements'],
    recommendations: ['Add AI section to existing acceptable use policy'],
  },
  implementationAdvisor: {
    ...MOCK_IMPLEMENTATION_RESPONSE,
    content: 'Quick implementation possible within 2 weeks. Minimal governance overhead needed.',
    confidence: 0.85,
    riskLevel: 'low' as const,
    reasoning: ['Low complexity', 'Existing infrastructure sufficient'],
    recommendations: ['2-week implementation sprint', 'Annual review schedule'],
  },
};

/** Scenario where agents DISAGREE on risk level */
export const MOCK_CONTESTED_RESPONSES = {
  riskAssessor: {
    ...MOCK_RISK_ASSESSOR_RESPONSE,
    riskLevel: 'high' as const,
    confidence: 0.80,
  },
  compliance: {
    ...MOCK_COMPLIANCE_RESPONSE,
    riskLevel: 'critical' as const,
    confidence: 0.75,
    reasoning: [
      'Potential prohibited use case under EU AI Act Article 5',
      'Social scoring characteristics identified',
    ],
  },
  policyArchitect: {
    ...MOCK_POLICY_ARCHITECT_RESPONSE,
    riskLevel: 'medium' as const,
    confidence: 0.65,
  },
  implementationAdvisor: {
    ...MOCK_IMPLEMENTATION_RESPONSE,
    riskLevel: 'medium' as const,
    confidence: 0.60,
  },
};

/** Agent response that contains negation — regression test for string matching bug */
export const MOCK_NEGATION_RESPONSE = {
  content:
    'After thorough analysis, this is NOT a critical risk and should NOT be classified as high-risk. The use case presents low risk with adequate controls in place.',
  confidence: 0.89,
  riskLevel: 'low' as const,
  reasoning: [
    'Adequate human oversight mechanisms exist',
    'No sensitive personal data processing',
    'Internal use only with no public-facing exposure',
  ],
  recommendations: ['Maintain current controls', 'Annual review sufficient'],
};
