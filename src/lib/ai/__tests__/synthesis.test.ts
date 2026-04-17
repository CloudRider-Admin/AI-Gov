import { describe, it, expect } from 'vitest';
import type { SynthesisResult, RiskLevel } from '../multiAgent';

/**
 * Tests for the synthesis result structure.
 * These validate that the synthesis agent output conforms to the expected schema.
 * (Actual synthesis calls require OpenAI — tested in integration tests.)
 */

function parseSynthesisResult(raw: string, fallbackRiskLevel: RiskLevel): SynthesisResult {
  const parsed = JSON.parse(raw);
  const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

  return {
    riskLevel: validRiskLevels.includes(parsed.riskLevel) ? parsed.riskLevel : fallbackRiskLevel,
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    agreements: Array.isArray(parsed.agreements) ? parsed.agreements : [],
    contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    keyRecommendations: Array.isArray(parsed.keyRecommendations) ? parsed.keyRecommendations : [],
  };
}

describe('SynthesisResult parsing', () => {
  it('should parse a well-formed synthesis response', () => {
    const raw = JSON.stringify({
      riskLevel: 'high',
      confidence: 0.85,
      summary: 'This hiring AI presents significant risk due to automated employment decisions.',
      agreements: ['All agents agree this is high-risk employment AI', 'DPIA is mandatory'],
      contradictions: ['Risk assessor says high but implementation advisor says medium — resolved: high due to regulatory classification'],
      gaps: ['No agent addressed data retention policies', 'Supply chain risk from vendor model not assessed'],
      keyRecommendations: ['Conduct bias audit', 'File DPIA', 'Implement human oversight'],
    });

    const result = parseSynthesisResult(raw, 'medium');
    expect(result.riskLevel).toBe('high');
    expect(result.confidence).toBe(0.85);
    expect(result.summary).toContain('hiring AI');
    expect(result.agreements).toHaveLength(2);
    expect(result.contradictions).toHaveLength(1);
    expect(result.gaps).toHaveLength(2);
    expect(result.keyRecommendations).toHaveLength(3);
  });

  it('should fallback to consensus risk level if synthesis gives invalid level', () => {
    const raw = JSON.stringify({
      riskLevel: 'extreme',
      confidence: 0.7,
      summary: 'test',
      agreements: [],
      contradictions: [],
      gaps: [],
      keyRecommendations: [],
    });

    const result = parseSynthesisResult(raw, 'high');
    expect(result.riskLevel).toBe('high'); // fallback to consensus
  });

  it('should handle missing arrays gracefully', () => {
    const raw = JSON.stringify({
      riskLevel: 'medium',
      confidence: 0.6,
      summary: 'Moderate risk assessment.',
    });

    const result = parseSynthesisResult(raw, 'medium');
    expect(result.agreements).toEqual([]);
    expect(result.contradictions).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.keyRecommendations).toEqual([]);
  });

  it('should clamp confidence to valid range', () => {
    const raw = JSON.stringify({ riskLevel: 'low', confidence: 1.5, summary: 'test' });
    expect(parseSynthesisResult(raw, 'low').confidence).toBe(1);

    const raw2 = JSON.stringify({ riskLevel: 'low', confidence: -0.3, summary: 'test' });
    expect(parseSynthesisResult(raw2, 'low').confidence).toBe(0);
  });
});
