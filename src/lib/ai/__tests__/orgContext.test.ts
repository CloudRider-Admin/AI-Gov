import { describe, expect, it } from 'vitest';

import {
  extractFromText,
  mergeOrgContext,
  renderOrgContextBlock,
  sizeFromHeadcount,
  type OrgContext,
} from '../orgContext';

describe('orgContext — pure helpers', () => {
  describe('sizeFromHeadcount', () => {
    it('classifies sizes by headcount band', () => {
      expect(sizeFromHeadcount(20)).toBe('small');
      expect(sizeFromHeadcount(280)).toBe('medium');
      expect(sizeFromHeadcount(2000)).toBe('large');
    });

    it('returns undefined for invalid input', () => {
      expect(sizeFromHeadcount(0)).toBeUndefined();
      expect(sizeFromHeadcount(-1)).toBeUndefined();
      expect(sizeFromHeadcount(NaN)).toBeUndefined();
    });
  });

  describe('mergeOrgContext', () => {
    it('overwrites scalars and unions arrays', () => {
      const base: OrgContext = {
        organizationName: 'Acme',
        industry: 'saas',
        knownAITools: ['ChatGPT'],
      };
      const update: Partial<OrgContext> = {
        industry: 'fintech',
        knownAITools: ['Claude'],
        riskAppetite: 'balanced',
      };
      const merged = mergeOrgContext(base, update);
      expect(merged.organizationName).toBe('Acme');
      expect(merged.industry).toBe('fintech');
      expect(merged.knownAITools).toEqual(['ChatGPT', 'Claude']);
      expect(merged.riskAppetite).toBe('balanced');
    });

    it('skips undefined and null fields', () => {
      const base: OrgContext = { industry: 'saas' };
      const merged = mergeOrgContext(base, { industry: undefined, organizationName: 'Acme' });
      expect(merged.industry).toBe('saas');
      expect(merged.organizationName).toBe('Acme');
    });
  });

  describe('extractFromText', () => {
    it('captures headcount + size from "280-person ecommerce SMB"', () => {
      const out = extractFromText('We are a 280-person ecommerce SMB rolling out AI.');
      expect(out.headcount).toBe(280);
      expect(out.size).toBe('medium');
      expect(out.industry).toBe('ecommerce');
    });

    it('captures industry for canonical sectors', () => {
      expect(extractFromText('We work in healthcare.').industry).toBe('healthcare');
      expect(extractFromText('B2B SaaS company').industry).toBe('saas');
      expect(extractFromText('Fintech startup').industry).toBe('fintech');
    });

    it('captures multiple AI tools mentioned in one message', () => {
      const out = extractFromText(
        'We use ChatGPT Enterprise, Microsoft Copilot, and Anthropic Claude across teams.',
      );
      expect(out.knownAITools).toContain('ChatGPT Enterprise');
      expect(out.knownAITools).toContain('Microsoft Copilot');
      expect(out.knownAITools).toContain('Anthropic Claude');
    });

    it('captures jurisdictions when stated explicitly', () => {
      const out = extractFromText('We operate in Germany and Ireland with HQ in California.');
      expect(out.jurisdictions).toEqual(expect.arrayContaining(['DE', 'IE', 'US-CA']));
    });

    it('captures risk appetite vocabulary', () => {
      expect(extractFromText('We have a conservative approach.').riskAppetite).toBe('conservative');
      expect(extractFromText('Our org is risk-averse.').riskAppetite).toBe('conservative');
      expect(extractFromText('We are aggressive about adoption.').riskAppetite).toBe('aggressive');
    });

    it('captures a governance lead title', () => {
      const out = extractFromText('Our VP of Operations owns AI governance.');
      expect(out.governanceLeadTitle).toMatch(/VP of Operations/i);
    });

    it('returns empty object when nothing recognizable is in the text', () => {
      const out = extractFromText('We are thinking about doing some stuff.');
      expect(out).toEqual({});
    });

    it('handles empty input safely', () => {
      expect(extractFromText('')).toEqual({});
    });
  });

  describe('renderOrgContextBlock', () => {
    it('returns empty string for an empty context', () => {
      expect(renderOrgContextBlock({})).toBe('');
    });

    it('renders the canonical heading + bullet structure', () => {
      const block = renderOrgContextBlock({
        organizationName: 'HarborCraft Home Goods',
        industry: 'ecommerce',
        headcount: 280,
        governanceLeadTitle: 'VP of Operations',
        escalationPath: ['AI Governance Lead', 'VP', 'CEO'],
        knownAITools: ['ChatGPT Enterprise', 'Microsoft Copilot', 'Zendesk AI'],
        jurisdictions: ['US', 'DE'],
        riskAppetite: 'balanced',
      });
      expect(block).toContain('ORGANIZATION CONTEXT');
      expect(block).toContain('HarborCraft Home Goods');
      expect(block).toContain('AI Governance Lead: VP of Operations');
      expect(block).toContain('AI Governance Lead → VP → CEO');
      expect(block).toContain('ChatGPT Enterprise, Microsoft Copilot, Zendesk AI');
      expect(block).toContain('Jurisdictions: US, DE');
      expect(block).toContain('Risk appetite: balanced');
    });

    it('omits sections that have no signal', () => {
      const block = renderOrgContextBlock({ industry: 'saas' });
      expect(block).toContain('ORGANIZATION CONTEXT');
      expect(block).toContain('saas');
      expect(block).not.toContain('Escalation path');
      expect(block).not.toContain('Risk appetite');
    });
  });
});
