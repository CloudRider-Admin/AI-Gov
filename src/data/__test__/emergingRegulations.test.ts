import { describe, it, expect } from 'vitest';
import { EMERGING_REGULATIONS, matchRegulations } from '../emergingRegulations';

describe('EMERGING_REGULATIONS', () => {
  it('should have at least 5 regulations', () => {
    expect(EMERGING_REGULATIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('each regulation should have required fields', () => {
    for (const reg of EMERGING_REGULATIONS) {
      expect(reg.id).toBeTruthy();
      expect(reg.name).toBeTruthy();
      expect(reg.shortName).toBeTruthy();
      expect(reg.jurisdiction).toBeTruthy();
      expect(['enacted', 'in-force', 'proposed', 'final-rule']).toContain(reg.status);
      expect(reg.summary.length).toBeGreaterThan(50);
      expect(reg.keyProvisions.length).toBeGreaterThanOrEqual(3);
      expect(reg.complianceActions.length).toBeGreaterThanOrEqual(3);
      expect(reg.relatedFrameworks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should include US EO 14110', () => {
    const eo = EMERGING_REGULATIONS.find(r => r.id === 'us-eo-14110');
    expect(eo).toBeDefined();
    expect(eo!.jurisdiction).toContain('United States');
    expect(eo!.status).toBe('in-force');
  });

  it('should include Colorado AI Act', () => {
    const co = EMERGING_REGULATIONS.find(r => r.id === 'colorado-ai-act');
    expect(co).toBeDefined();
    expect(co!.effectiveDate).toBe('2026-02-01');
    expect(co!.status).toBe('enacted');
  });

  it('should include Canada AIDA', () => {
    const aida = EMERGING_REGULATIONS.find(r => r.id === 'canada-aida');
    expect(aida).toBeDefined();
    expect(aida!.status).toBe('proposed');
  });

  it('should include NYC LL 144', () => {
    const nyc = EMERGING_REGULATIONS.find(r => r.id === 'nyc-ll-144');
    expect(nyc).toBeDefined();
    expect(nyc!.affectedSectors).toContain('employment');
  });
});

describe('matchRegulations', () => {
  it('should match EO 14110 for federal AI queries', () => {
    const results = matchRegulations('Federal government AI red-teaming requirements');
    expect(results.some(r => r.id === 'us-eo-14110')).toBe(true);
  });

  it('should match Colorado AI Act for employment discrimination queries', () => {
    const results = matchRegulations('Colorado algorithmic discrimination in hiring decisions');
    expect(results.some(r => r.id === 'colorado-ai-act')).toBe(true);
  });

  it('should match NYC LL 144 for hiring tool queries', () => {
    const results = matchRegulations('automated employment decision tool bias audit NYC');
    expect(results.some(r => r.id === 'nyc-ll-144')).toBe(true);
  });

  it('should match by short name', () => {
    const results = matchRegulations('How does Canada AIDA affect us?');
    expect(results.some(r => r.id === 'canada-aida')).toBe(true);
  });

  it('should respect limit parameter', () => {
    const results = matchRegulations('AI regulation compliance government employment', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should return empty for unrelated queries', () => {
    const results = matchRegulations('xyz qqq zzz bloop');
    expect(results).toHaveLength(0);
  });
});