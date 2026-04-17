import { describe, it, expect } from 'vitest';
import {
  MultiAgentOrchestrator,
  deduplicateRecommendations,
  AGENT_WEIGHTS,
  type AgentResponse,
} from '../multiAgent';
import {
  MOCK_RISK_ASSESSOR_RESPONSE,
  MOCK_COMPLIANCE_RESPONSE,
  MOCK_POLICY_ARCHITECT_RESPONSE,
  MOCK_IMPLEMENTATION_RESPONSE,
  MOCK_LOW_RISK_RESPONSES,
  MOCK_CONTESTED_RESPONSES,
  MOCK_NEGATION_RESPONSE,
} from '@/test/fixtures/agentResponses';

function makeAgentResponse(
  agentId: string,
  overrides: Partial<AgentResponse> = {},
): AgentResponse {
  return {
    agentId,
    content: 'test content',
    confidence: 0.8,
    riskLevel: 'medium',
    reasoning: ['test reason'],
    recommendations: ['test recommendation'],
    ...overrides,
  };
}

describe('MultiAgentOrchestrator.generateConsensus', () => {
  const orchestrator = new MultiAgentOrchestrator();

  it('should return high risk when all agents agree on high', () => {
    const responses: AgentResponse[] = [
      makeAgentResponse('risk-assessor', MOCK_RISK_ASSESSOR_RESPONSE),
      makeAgentResponse('compliance-expert', MOCK_COMPLIANCE_RESPONSE),
      makeAgentResponse('policy-architect', MOCK_POLICY_ARCHITECT_RESPONSE),
      makeAgentResponse('implementation-advisor', MOCK_IMPLEMENTATION_RESPONSE),
    ];

    const consensus = orchestrator.generateConsensus(responses);
    // 3 agents say high (3), 1 says medium (2)
    // Weighted: 0.4*3 + 0.3*3 + 0.15*3 + 0.15*2 = 1.2+0.9+0.45+0.3 = 2.85 → rounds to 3 = high
    expect(consensus.riskLevel).toBe('high');
    expect(consensus.contested).toBe(false);
  });

  it('should return low risk when all agents agree on low', () => {
    const responses: AgentResponse[] = [
      makeAgentResponse('risk-assessor', MOCK_LOW_RISK_RESPONSES.riskAssessor),
      makeAgentResponse('compliance-expert', MOCK_LOW_RISK_RESPONSES.compliance),
      makeAgentResponse('policy-architect', MOCK_LOW_RISK_RESPONSES.policyArchitect),
      makeAgentResponse('implementation-advisor', MOCK_LOW_RISK_RESPONSES.implementationAdvisor),
    ];

    const consensus = orchestrator.generateConsensus(responses);
    expect(consensus.riskLevel).toBe('low');
    expect(consensus.contested).toBe(false);
  });

  it('should flag contested when agents disagree by 2+ levels', () => {
    const responses: AgentResponse[] = [
      makeAgentResponse('risk-assessor', MOCK_CONTESTED_RESPONSES.riskAssessor),
      makeAgentResponse('compliance-expert', MOCK_CONTESTED_RESPONSES.compliance),
      makeAgentResponse('policy-architect', MOCK_CONTESTED_RESPONSES.policyArchitect),
      makeAgentResponse('implementation-advisor', MOCK_CONTESTED_RESPONSES.implementationAdvisor),
    ];

    const consensus = orchestrator.generateConsensus(responses);
    expect(consensus.contested).toBe(true);
    // When contested, should ceil (conservative) — should be high or critical
    expect(['high', 'critical']).toContain(consensus.riskLevel);
  });

  it('should NOT extract risk level from prose content (regression for string-matching bug)', () => {
    // This response says "NOT critical" and "NOT high-risk" in the content
    // but has riskLevel: 'low' — the old code would have said "critical"
    const responses: AgentResponse[] = [
      makeAgentResponse('risk-assessor', {
        ...MOCK_NEGATION_RESPONSE,
        riskLevel: 'low',
      }),
      makeAgentResponse('compliance-expert', { riskLevel: 'low', confidence: 0.9 }),
      makeAgentResponse('policy-architect', { riskLevel: 'low', confidence: 0.85 }),
      makeAgentResponse('implementation-advisor', { riskLevel: 'low', confidence: 0.8 }),
    ];

    const consensus = orchestrator.generateConsensus(responses);
    expect(consensus.riskLevel).toBe('low');
    expect(consensus.riskLevel).not.toBe('critical');
  });

  it('should weight primary agent (risk-assessor) at 40%', () => {
    expect(AGENT_WEIGHTS['risk-assessor']).toBe(0.40);
    expect(AGENT_WEIGHTS['compliance-expert']).toBe(0.30);
    expect(AGENT_WEIGHTS['policy-architect']).toBe(0.15);
    expect(AGENT_WEIGHTS['implementation-advisor']).toBe(0.15);
  });

  it('should compute weighted confidence correctly', () => {
    const responses: AgentResponse[] = [
      makeAgentResponse('risk-assessor', { confidence: 1.0, riskLevel: 'medium' }),
      makeAgentResponse('compliance-expert', { confidence: 0.5, riskLevel: 'medium' }),
      makeAgentResponse('policy-architect', { confidence: 0.5, riskLevel: 'medium' }),
      makeAgentResponse('implementation-advisor', { confidence: 0.5, riskLevel: 'medium' }),
    ];

    const consensus = orchestrator.generateConsensus(responses);
    // Weighted: (1.0*0.4 + 0.5*0.3 + 0.5*0.15 + 0.5*0.15) / 1.0 = 0.7
    expect(consensus.confidence).toBeCloseTo(0.7, 2);
  });

  it('should default to higher risk when contested (conservative)', () => {
    // Primary says critical (4), others say low (1)
    const responses: AgentResponse[] = [
      makeAgentResponse('risk-assessor', { riskLevel: 'critical', confidence: 0.9 }),
      makeAgentResponse('compliance-expert', { riskLevel: 'low', confidence: 0.9 }),
      makeAgentResponse('policy-architect', { riskLevel: 'low', confidence: 0.9 }),
      makeAgentResponse('implementation-advisor', { riskLevel: 'low', confidence: 0.9 }),
    ];

    const consensus = orchestrator.generateConsensus(responses);
    expect(consensus.contested).toBe(true);
    // Weighted: 0.4*4 + 0.3*1 + 0.15*1 + 0.15*1 = 1.6+0.3+0.15+0.15 = 2.2
    // Ceil(2.2) = 3 = high (conservative rounding up)
    expect(consensus.riskLevel).toBe('high');
  });

  it('should handle empty responses gracefully', () => {
    const consensus = orchestrator.generateConsensus([]);
    expect(consensus.riskLevel).toBeDefined();
    expect(consensus.keyRecommendations).toEqual([]);
    expect(consensus.contested).toBe(false);
  });

  it('should handle single agent response', () => {
    const responses: AgentResponse[] = [
      makeAgentResponse('risk-assessor', { riskLevel: 'high', confidence: 0.85 }),
    ];

    const consensus = orchestrator.generateConsensus(responses);
    expect(consensus.riskLevel).toBe('high');
    expect(consensus.contested).toBe(false);
  });
});

describe('deduplicateRecommendations', () => {
  it('should remove exact duplicates', () => {
    const recs = [
      'Implement human oversight',
      'Implement human oversight',
      'Conduct bias audit',
    ];
    expect(deduplicateRecommendations(recs, 5)).toEqual([
      'Implement human oversight',
      'Conduct bias audit',
    ]);
  });

  it('should remove near-duplicates with >50% word overlap', () => {
    const recs = [
      'Implement mandatory human review for all rejection decisions',
      'Implement mandatory human review for rejection decisions immediately',
      'Conduct bias audit across protected characteristics',
    ];
    const result = deduplicateRecommendations(recs, 5);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe('Conduct bias audit across protected characteristics');
  });

  it('should keep distinct recommendations', () => {
    const recs = [
      'Deploy monitoring for disparate impact metrics',
      'File DPIA with data protection authority',
      'Establish AI Ethics Committee',
    ];
    expect(deduplicateRecommendations(recs, 5)).toHaveLength(3);
  });

  it('should respect the limit parameter', () => {
    const recs = [
      'Implement human oversight mechanisms',
      'Conduct a bias audit',
      'File DPIA with the authority',
      'Establish ethics committee',
      'Deploy monitoring dashboards',
      'Train staff on AI policy',
      'Create incident response plan',
      'Review vendor contracts',
    ];
    expect(deduplicateRecommendations(recs, 5)).toHaveLength(5);
  });

  it('should handle empty input', () => {
    expect(deduplicateRecommendations([], 5)).toEqual([]);
  });
});
