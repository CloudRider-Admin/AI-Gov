import { describe, it, expect } from 'vitest';
import { parseAdvisorResponse, buildValidatedResponse, applyGating } from '../responseParser';
import type { AdvisorResponse } from '../schemas';

describe('parseAdvisorResponse', () => {
  it('should parse valid JSON directly', () => {
    const raw = JSON.stringify({
      riskProfile: { level: 'high', description: 'test', confidence: 0.9, reasoning: ['r1'] },
      suggestedPolicies: [],
      regulationCheck: [],
      followUpQuestions: [],
      sources: [],
    });

    const result = parseAdvisorResponse(raw);
    expect(result.riskProfile?.level).toBe('high');
    expect(result.riskProfile?.confidence).toBe(0.9);
  });

  it('should handle JSON wrapped in markdown code blocks', () => {
    const raw = '```json\n{"riskProfile":{"level":"low","description":"safe","confidence":0.8,"reasoning":[]}}\n```';
    const result = parseAdvisorResponse(raw);
    expect(result.riskProfile?.level).toBe('low');
  });

  it('should extract JSON from mixed text', () => {
    const raw = 'Here is my analysis:\n\n{"riskProfile":{"level":"medium","description":"moderate risk","confidence":0.7,"reasoning":["reason"]}}\n\nHope that helps!';
    const result = parseAdvisorResponse(raw);
    expect(result.riskProfile?.level).toBe('medium');
  });

  it('should fall back to clarification mode for completely unparseable text', () => {
    const raw = 'This is just plain text with no JSON at all.';
    const result = parseAdvisorResponse(raw);
    expect(result.mode).toBe('clarification');
    expect(result.riskProfile?.level).toBe('medium');
    expect(result.riskProfile?.confidence).toBeLessThan(0.5);
    expect(result.followUpQuestions?.length).toBeGreaterThanOrEqual(3);
    expect(result.suggestedPolicies).toEqual([]);
    expect(result.regulationCheck).toEqual([]);
  });

  it('should repair truncated JSON missing closing braces', () => {
    const raw = '{"mode":"assessment","riskProfile":{"level":"high","description":"big risk","confidence":0.8,"reasoning":["one","two"';
    const result = parseAdvisorResponse(raw);
    expect(result.mode).toBe('assessment');
    expect(result.riskProfile?.level).toBe('high');
    expect(result.riskProfile?.reasoning).toEqual(['one', 'two']);
  });

  it('should repair JSON with a trailing comma', () => {
    const raw = '{"mode":"assessment","followUpQuestions":["a","b",]}';
    const result = parseAdvisorResponse(raw);
    expect(result.followUpQuestions).toEqual(['a', 'b']);
  });

  it('should handle empty string', () => {
    const result = parseAdvisorResponse('');
    expect(result.riskProfile).toBeDefined();
  });
});

describe('buildValidatedResponse — GPT-4o normalization', () => {
  const emptyRag = { context: null, documents: [], sources: [] };

  it('should normalize exact GPT-4o response with all known deviations', () => {
    const gptRaw = JSON.stringify({
      riskProfile: { level: 'High', confidenceScore: 0.85 },
      suggestedPolicies: [
        { policy: 'Bias Assessment', priority: 'High', description: 'Audit for bias' },
        { policy: 'Transparency', priority: 'Medium', description: 'Explain decisions' },
      ],
      regulationCheck: [
        { regulation: 'GDPR', relevance: 'High', description: 'GDPR applies' },
        { regulation: 'EU AI Act', relevance: 'high', description: 'High-risk system' },
      ],
      followUpQuestions: ['What models?', 'What data?'],
      sources: ['NIST AI RMF'],
      intent: 'Provide governance recommendations',
    });

    const parsed = parseAdvisorResponse(gptRaw);
    const result = buildValidatedResponse(parsed, 'conv-123', emptyRag);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.riskProfile.level).toBe('high');
    expect(result.data.riskProfile.confidence).toBe(0.85);
    expect(result.data.riskProfile.description).toBeTruthy();
    expect(result.data.suggestedPolicies[0].title).toBe('Bias Assessment');
    expect(result.data.suggestedPolicies[0].category).toBe('governance');
    expect(result.data.suggestedPolicies[0].priority).toBe('high');
    expect(result.data.regulationCheck[0].article).toBeTruthy();
    expect(result.data.regulationCheck[0].relevance).toBe('high');
    expect(result.data.intent?.type).toBe('advisor');
  });

  it('should handle string confidence like "High"', () => {
    const parsed = parseAdvisorResponse(JSON.stringify({
      riskProfile: { level: 'medium', confidence: 'High' },
      suggestedPolicies: [],
      regulationCheck: [],
      followUpQuestions: [],
      sources: [],
    }));

    const result = buildValidatedResponse(parsed, 'conv', emptyRag);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskProfile.confidence).toBe(0.85);
    }
  });

  it('should handle missing riskProfile fields gracefully', () => {
    const parsed = parseAdvisorResponse(JSON.stringify({
      riskProfile: { level: 'low' },
      suggestedPolicies: [],
      regulationCheck: [],
      followUpQuestions: [],
      sources: [],
    }));

    const result = buildValidatedResponse(parsed, 'conv', emptyRag);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskProfile.confidence).toBe(0.6);
      expect(result.data.riskProfile.description).toBeTruthy();
      expect(Array.isArray(result.data.riskProfile.reasoning)).toBe(true);
    }
  });
});

describe('applyGating', () => {
  const baseResponse: AdvisorResponse = {
    mode: 'assessment',
    riskProfile: { level: 'high', description: 'test', confidence: 0.9, reasoning: ['r1'] },
    suggestedPolicies: [
      { title: 'P1', description: 'D1', priority: 'high', category: 'governance' },
      { title: 'P2', description: 'D2', priority: 'medium', category: 'compliance' },
      { title: 'P3', description: 'D3', priority: 'low', category: 'data' },
    ],
    regulationCheck: [
      { regulation: 'GDPR', article: 'Article 22', relevance: 'high', description: 'Automated decisions' },
    ],
    followUpQuestions: ['Q1', 'Q2'],
    sources: ['NIST AI RMF'],
    conversationId: 'test-conv',
    timestamp: new Date().toISOString(),
  };

  it('should gate GUEST users to 1 policy and no regulations', () => {
    const gated = applyGating(baseResponse, 'GUEST');
    expect(gated.suggestedPolicies).toHaveLength(1);
    expect(gated.regulationCheck).toHaveLength(0);
    expect(gated.gated).toBe(true);
  });

  it('should gate FREE users to 1 policy and no regulations', () => {
    const gated = applyGating(baseResponse, 'FREE');
    expect(gated.suggestedPolicies).toHaveLength(1);
    expect(gated.regulationCheck).toHaveLength(0);
    expect(gated.gated).toBe(true);
  });

  it('should NOT gate PRO users', () => {
    const result = applyGating(baseResponse, 'PRO');
    expect(result.suggestedPolicies).toHaveLength(3);
    expect(result.regulationCheck).toHaveLength(1);
    expect(result.gated).toBeUndefined();
  });

  it('should NOT gate TEAM users', () => {
    const result = applyGating(baseResponse, 'TEAM');
    expect(result.suggestedPolicies).toHaveLength(3);
    expect(result.regulationCheck).toHaveLength(1);
  });

  it('should attach generatedArtifact for paid users', () => {
    const artifact = { type: 'intake', id: 'art-1', data: {} };
    const result = applyGating(baseResponse, 'PRO', artifact);
    expect(result.generatedArtifact).toEqual(artifact);
  });

  it('should NOT attach generatedArtifact for gated users', () => {
    const artifact = { type: 'intake', id: 'art-1', data: {} };
    const result = applyGating(baseResponse, 'FREE', artifact);
    expect(result.generatedArtifact).toBeUndefined();
    expect(result.gated).toBe(true);
  });
});
describe('follow-up choices', () => {
  const base = {
    mode: 'clarification',
    riskProfile: { level: 'medium', description: 'Need context', confidence: 0.4, reasoning: [] },
    suggestedPolicies: [],
    regulationCheck: [],
    sources: [],
  };

  it('flattens question objects and keeps index-aligned options', () => {
    const parsed = parseAdvisorResponse(
      JSON.stringify({
        ...base,
        followUpQuestions: [
          { question: 'What kind of AI system is it?', options: ['Generative AI', 'Predictive model', 'Vendor feature'] },
          'What is the system called?',
          { question: 'Which data does it use?', options: ['Personal data', 'Health data', 'Personal data'], multiSelect: true },
        ],
      }),
    );
    expect(parsed.followUpQuestions).toEqual([
      'What kind of AI system is it?',
      'What is the system called?',
      'Which data does it use?',
    ]);
    expect(parsed.followUpChoices).toEqual([
      { options: ['Generative AI', 'Predictive model', 'Vendor feature'], multiSelect: false },
      null,
      { options: ['Personal data', 'Health data'], multiSelect: true },
    ]);
  });

  it('leaves legacy string questions without choices', () => {
    const parsed = parseAdvisorResponse(JSON.stringify({ ...base, followUpQuestions: ['Q1?', 'Q2?'] }));
    expect(parsed.followUpQuestions).toEqual(['Q1?', 'Q2?']);
    expect(parsed.followUpChoices).toBeUndefined();
  });

  it('removes catch-all options the UI already provides', () => {
    const parsed = parseAdvisorResponse(
      JSON.stringify({ ...base, followUpQuestions: [{ question: 'A?', options: ['Chatbot', 'Other departments', 'Other', 'Other (please specify)', 'Something else…'] }] }),
    );
    expect(parsed.followUpChoices).toEqual([{ options: ['Chatbot', 'Other departments'], multiSelect: false }]);
  });

  it('drops single-option lists and caps options at five', () => {
    const parsed = parseAdvisorResponse(
      JSON.stringify({
        ...base,
        followUpQuestions: [
          { question: 'A?', options: ['only one'] },
          { question: 'B?', options: ['1', '2', '3', '4', '5', '6'] },
        ],
      }),
    );
    expect(parsed.followUpChoices).toEqual([null, { options: ['1', '2', '3', '4', '5'], multiSelect: false }]);
  });

  it('carries choices through validation', () => {
    const parsed = parseAdvisorResponse(
      JSON.stringify({ ...base, followUpQuestions: [{ question: 'A?', options: ['x', 'y'] }] }),
    );
    const result = buildValidatedResponse(parsed, 'conv-1', {
      context: '',
      sources: [],
      sourcesStructured: [],
    } as unknown as Parameters<typeof buildValidatedResponse>[2]);
    const data = result.success ? result.data : result.fallback;
    expect(data.followUpQuestions).toEqual(['A?']);
    expect(data.followUpChoices).toEqual([{ options: ['x', 'y'], multiSelect: false }]);
  });
});
