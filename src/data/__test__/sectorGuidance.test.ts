import { describe, it, expect } from 'vitest';
import { SECTOR_GUIDANCE, matchSectors } from '../sectorGuidance';

describe('SECTOR_GUIDANCE', () => {
  it('should have three sectors: finance, healthcare, government', () => {
    const ids = SECTOR_GUIDANCE.map(s => s.id);
    expect(ids).toContain('finance');
    expect(ids).toContain('healthcare');
    expect(ids).toContain('government');
    expect(SECTOR_GUIDANCE).toHaveLength(3);
  });

  it('each sector should have required fields populated', () => {
    for (const sector of SECTOR_GUIDANCE) {
      expect(sector.displayName).toBeTruthy();
      expect(sector.description).toBeTruthy();
      expect(sector.keyRegulations.length).toBeGreaterThanOrEqual(3);
      expect(sector.riskFactors.length).toBeGreaterThanOrEqual(3);
      expect(sector.recommendations.length).toBeGreaterThanOrEqual(3);
      expect(sector.frameworkPriorities.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('each sector should reference all three major frameworks', () => {
    for (const sector of SECTOR_GUIDANCE) {
      const frameworks = sector.frameworkPriorities.map(f => f.framework);
      expect(frameworks).toContain('NIST AI RMF');
      expect(frameworks).toContain('EU AI Act');
      expect(frameworks).toContain('ISO 42001');
    }
  });
});

describe('matchSectors', () => {
  it('should match finance sector for banking queries', () => {
    const results = matchSectors('We use AI for credit scoring in our banking operations');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('finance');
  });

  it('should match healthcare sector for medical queries', () => {
    const results = matchSectors('Our AI helps with clinical diagnosis in the hospital');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('healthcare');
  });

  it('should match government sector for public sector queries', () => {
    const results = matchSectors('Federal agency deploying AI for benefits determination');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('government');
  });

  it('should return empty for unrelated queries', () => {
    const results = matchSectors('What is the weather like today?');
    expect(results).toHaveLength(0);
  });

  it('should match multiple sectors when query spans domains', () => {
    const results = matchSectors('AI fraud detection for government health insurance claims');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should rank by relevance — more keyword matches first', () => {
    const results = matchSectors('lending credit loan mortgage financial underwriting AI');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('finance');
  });
});