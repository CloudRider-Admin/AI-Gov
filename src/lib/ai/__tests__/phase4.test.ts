import { describe, expect, it } from 'vitest';

import { getAgentFrameworkContext } from '../multiAgent';
import { GOVSECURE_FALLBACK_DOCUMENTS, knowledgeBase } from '../knowledgeBase';
import { shouldBoostGovSecure } from '../vectorSearch';

describe('Phase 4 — agent context enrichment', () => {
  it('risk-assessor sees the GovSecure 4-tier model and auto-high triggers', () => {
    const ctx = getAgentFrameworkContext('risk-assessor');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('GOVSECURE 4-TIER RISK MODEL');
    expect(ctx).toContain('GOVSECURE AUTO-HIGH TRIGGERS');
    expect(ctx).toContain('Risk Assessment Kitchen');
    // Original NIST framework context is still present
    expect(ctx).toContain('NIST AI RMF Trustworthiness Characteristics');
  });

  it('compliance-expert sees the GovSecure Policy Suite Map', () => {
    const ctx = getAgentFrameworkContext('compliance-expert');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('GOVSECURE POLICY SUITE MAP');
    expect(ctx).toContain('Starter');
    expect(ctx).toContain('Operational');
    expect(ctx).toContain('Maturity');
    expect(ctx).toContain('EU AI Act');
  });

  it('policy-architect sees the AI Chef stations + 15-policy structure', () => {
    const ctx = getAgentFrameworkContext('policy-architect');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('GOVSECURE AI CHEF');
    expect(ctx).toContain('Station S1');
    expect(ctx).toContain('Station S6');
    expect(ctx).toContain('GOVSECURE 15-POLICY SUITE');
    expect(ctx).toContain('ISO/IEC 42001');
  });

  it('implementation-advisor sees the 90-Day Blueprint phases', () => {
    const ctx = getAgentFrameworkContext('implementation-advisor');
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('GOVSECURE 90-DAY IMPLEMENTATION BLUEPRINT');
    expect(ctx).toContain('Phase 1');
    expect(ctx).toContain('Phase 3');
    expect(ctx).toContain('NIST AI RMF — Key Actions');
  });

  it('returns null for unknown agent ids', () => {
    expect(getAgentFrameworkContext('not-a-real-agent')).toBeNull();
  });
});

describe('Phase 4 — static GovSecure KB fallback entries', () => {
  it('exposes 3 fallback documents', () => {
    expect(GOVSECURE_FALLBACK_DOCUMENTS).toHaveLength(3);
    const ids = GOVSECURE_FALLBACK_DOCUMENTS.map((d) => d.id);
    expect(ids).toContain('govsecure-ai-chef-overview');
    expect(ids).toContain('govsecure-policy-suite-overview');
    expect(ids).toContain('govsecure-90-day-blueprint-overview');
  });

  it('every fallback carries the GovSecure tag and a real source', () => {
    for (const d of GOVSECURE_FALLBACK_DOCUMENTS) {
      expect(d.tags).toContain('GovSecure');
      expect(d.source).toMatch(/GovSecure/);
      expect(d.content.length).toBeGreaterThan(200);
    }
  });

  it('keyword search surfaces the AI Chef fallback for "AI Chef" queries', () => {
    const result = knowledgeBase.search('AI Chef operating model', undefined, 5);
    const titles = result.documents.map((d) => d.title);
    expect(titles.some((t) => t.includes('AI Chef'))).toBe(true);
  });

  it('keyword search surfaces the Policy Suite fallback for "policy suite" queries', () => {
    const result = knowledgeBase.search('GovSecure policy suite where to start', undefined, 5);
    const titles = result.documents.map((d) => d.title);
    expect(titles.some((t) => t.includes('Policy Suite'))).toBe(true);
  });

  it('keyword search surfaces the 90-Day Blueprint fallback for "90 day" queries', () => {
    const result = knowledgeBase.search('90 day implementation blueprint', undefined, 5);
    const titles = result.documents.map((d) => d.title);
    expect(titles.some((t) => t.includes('90-Day'))).toBe(true);
  });
});

describe('Phase 4 — shouldBoostGovSecure', () => {
  it('triggers on GovSecure flagship terms', () => {
    expect(shouldBoostGovSecure('How does the AI Chef operating model work?')).toBe(true);
    expect(shouldBoostGovSecure('Show me the 90-day blueprint')).toBe(true);
    expect(shouldBoostGovSecure('What policies are in the policy suite?')).toBe(true);
    expect(shouldBoostGovSecure('Run the TPRM questionnaire')).toBe(true);
    expect(shouldBoostGovSecure('GovSecure recommends what?')).toBe(true);
  });

  it('does NOT trigger on generic NIST/EU queries', () => {
    expect(shouldBoostGovSecure('Generate a NIST AI RMF playbook')).toBe(false);
    expect(shouldBoostGovSecure('What are the EU AI Act high-risk categories?')).toBe(false);
    expect(shouldBoostGovSecure('Explain ISO/IEC 42001 clause 6')).toBe(false);
  });
});
