import { describe, it, expect } from 'vitest';
import { getAgentFrameworkContext } from '../multiAgent';

describe('getAgentFrameworkContext', () => {
  it('should return NIST trustworthiness characteristics for risk-assessor', () => {
    const context = getAgentFrameworkContext('risk-assessor');
    expect(context).not.toBeNull();
    expect(context).toContain('Valid and Reliable');
    expect(context).toContain('Safe');
    expect(context).toContain('Fair with Harmful Bias Managed');
    expect(context).toContain('Tier 1');
    expect(context).toContain('Tier 4');
    expect(context).toContain('Adaptive');
  });

  it('should return EU AI Act high-risk areas and prohibited practices for compliance-expert', () => {
    const context = getAgentFrameworkContext('compliance-expert');
    expect(context).not.toBeNull();
    // High-risk areas
    expect(context).toContain('Employment and Worker Management');
    expect(context).toContain('Credit scoring');
    expect(context).toContain('Biometrics');
    // Prohibited practices
    expect(context).toContain('Social Scoring');
    expect(context).toContain('Harmful Manipulation');
    // Penalties
    expect(context).toContain('€35 million');
    // Timeline
    expect(context).toContain('February 2, 2025');
  });

  it('should return ISO 42001 clause requirements for policy-architect', () => {
    const context = getAgentFrameworkContext('policy-architect');
    expect(context).not.toBeNull();
    expect(context).toContain('ISO/IEC 42001');
    expect(context).toContain('Leadership and Commitment');
    expect(context).toContain('AI Policy');
    expect(context).toContain('AI risk assessment');
  });

  it('should return NIST key actions and EU AI Act requirements for implementation-advisor', () => {
    const context = getAgentFrameworkContext('implementation-advisor');
    expect(context).not.toBeNull();
    // NIST actions
    expect(context).toContain('GOVERN');
    expect(context).toContain('MAP');
    expect(context).toContain('MEASURE');
    expect(context).toContain('MANAGE');
    // EU AI Act requirements
    expect(context).toContain('Risk Management System');
    expect(context).toContain('Data Governance');
    expect(context).toContain('Human Oversight');
  });

  it('should return null for unknown agent ID', () => {
    expect(getAgentFrameworkContext('unknown-agent')).toBeNull();
  });

  it('should produce context of reasonable length (not too long for token limits)', () => {
    for (const agentId of ['risk-assessor', 'compliance-expert', 'policy-architect', 'implementation-advisor']) {
      const context = getAgentFrameworkContext(agentId);
      expect(context).not.toBeNull();
      // Each context should be between 200 and 5000 chars (reasonable for a prompt section)
      expect(context!.length).toBeGreaterThan(200);
      expect(context!.length).toBeLessThan(5000);
    }
  });
});
