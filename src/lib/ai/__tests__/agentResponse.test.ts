import { describe, it, expect } from 'vitest';
import type { AgentResponse, RiskLevel } from '../multiAgent';

/**
 * Tests for the AgentResponse type structure and validation.
 * These verify that agent responses conform to the expected schema
 * after the P0 fix (response_format: json_object + riskLevel field).
 */

function parseAgentResponse(raw: string, agentId: string): AgentResponse {
  const parsed = JSON.parse(raw);
  const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  const riskLevel = validRiskLevels.includes(parsed.riskLevel)
    ? parsed.riskLevel
    : 'medium';

  return {
    agentId,
    content: typeof parsed.content === 'string' ? parsed.content : raw.slice(0, 500),
    confidence: typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5,
    riskLevel,
    reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}

describe('Agent response parsing (with response_format: json_object)', () => {
  it('should parse a well-formed agent response', () => {
    const raw = JSON.stringify({
      content: 'This is a high-risk use case.',
      riskLevel: 'high',
      confidence: 0.88,
      reasoning: ['Employment decisions are high-stakes'],
      recommendations: ['Implement human oversight'],
    });

    const result = parseAgentResponse(raw, 'risk-assessor');
    expect(result.riskLevel).toBe('high');
    expect(result.confidence).toBe(0.88);
    expect(result.reasoning).toHaveLength(1);
    expect(result.recommendations).toHaveLength(1);
  });

  it('should default riskLevel to medium if missing', () => {
    const raw = JSON.stringify({
      content: 'Analysis complete.',
      confidence: 0.7,
      reasoning: [],
      recommendations: [],
    });

    const result = parseAgentResponse(raw, 'compliance-expert');
    expect(result.riskLevel).toBe('medium');
  });

  it('should default riskLevel to medium if invalid value', () => {
    const raw = JSON.stringify({
      content: 'Analysis complete.',
      riskLevel: 'extreme',
      confidence: 0.7,
      reasoning: [],
      recommendations: [],
    });

    const result = parseAgentResponse(raw, 'compliance-expert');
    expect(result.riskLevel).toBe('medium');
  });

  it('should clamp confidence to [0, 1]', () => {
    const raw = JSON.stringify({
      content: 'Test',
      riskLevel: 'low',
      confidence: 1.5,
      reasoning: [],
      recommendations: [],
    });

    const result = parseAgentResponse(raw, 'risk-assessor');
    expect(result.confidence).toBe(1);
  });

  it('should clamp negative confidence to 0', () => {
    const raw = JSON.stringify({
      content: 'Test',
      riskLevel: 'low',
      confidence: -0.5,
      reasoning: [],
      recommendations: [],
    });

    const result = parseAgentResponse(raw, 'risk-assessor');
    expect(result.confidence).toBe(0);
  });

  it('should default confidence to 0.5 if not a number', () => {
    const raw = JSON.stringify({
      content: 'Test',
      riskLevel: 'low',
      confidence: 'high',
      reasoning: [],
      recommendations: [],
    });

    const result = parseAgentResponse(raw, 'risk-assessor');
    expect(result.confidence).toBe(0.5);
  });

  it('should handle missing reasoning/recommendations arrays', () => {
    const raw = JSON.stringify({
      content: 'Partial response.',
      riskLevel: 'medium',
      confidence: 0.6,
    });

    const result = parseAgentResponse(raw, 'policy-architect');
    expect(result.reasoning).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it('should use content string even if other fields are malformed', () => {
    const raw = JSON.stringify({
      content: 'This is the important analysis.',
      riskLevel: 123,
      confidence: 'not-a-number',
      reasoning: 'not an array',
      recommendations: null,
    });

    const result = parseAgentResponse(raw, 'risk-assessor');
    expect(result.content).toBe('This is the important analysis.');
    expect(result.riskLevel).toBe('medium');
    expect(result.confidence).toBe(0.5);
    expect(result.reasoning).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it('should throw on completely invalid JSON', () => {
    expect(() => parseAgentResponse('not json at all', 'risk-assessor')).toThrow();
  });
});