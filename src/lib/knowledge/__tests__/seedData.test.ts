import { describe, it, expect } from 'vitest';
import { getAllSeedEntries } from '../seedData';

describe('getAllSeedEntries — Phase 1 acceptance', () => {
  it('returns ≥250 total entries', async () => {
    const entries = await getAllSeedEntries();
    expect(entries.length).toBeGreaterThanOrEqual(250);
  });

  it('includes GovSecure-tagged entries from all three builders', async () => {
    const entries = await getAllSeedEntries();
    const govsecure = entries.filter((e) => e.sourceType === 'govsecure');

    expect(govsecure.length).toBeGreaterThanOrEqual(135);

    const policyEntries = govsecure.filter((e) => e.tags.includes('policy'));
    const checklistEntries = govsecure.filter((e) => e.tags.includes('checklist'));
    const riskTierEntries = govsecure.filter((e) => e.tags.includes('risk-tier'));
    const aiChefEntries = govsecure.filter((e) => e.tags.includes('ai-chef'));
    const blueprintEntries = govsecure.filter((e) => e.tags.includes('90-day-blueprint'));

    expect(policyEntries.length).toBeGreaterThan(0);
    expect(checklistEntries.length).toBeGreaterThanOrEqual(20);
    expect(riskTierEntries.length).toBe(4);
    expect(aiChefEntries.length).toBeGreaterThanOrEqual(7);
    expect(blueprintEntries.length).toBeGreaterThanOrEqual(4);
  });

  it('every GovSecure entry has non-empty title and content', async () => {
    const entries = await getAllSeedEntries();
    const govsecure = entries.filter((e) => e.sourceType === 'govsecure');

    for (const entry of govsecure) {
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.content.trim().length).toBeGreaterThan(0);
      expect(entry.tags).toContain('govsecure');
    }
  });

  it('surfaces a result for the canonical Phase 1 keyword queries', async () => {
    const entries = await getAllSeedEntries();
    const titleAndContent = (e: { title: string; content: string }) =>
      `${e.title}\n${e.content}`.toLowerCase();

    const queries = [
      'acceptable use',
      'vendor risk',
      '90-day',
      'risk tier',
      'ai chef',
    ];

    for (const q of queries) {
      const hit = entries.find((e) => titleAndContent(e).includes(q));
      expect(hit, `expected at least one entry matching "${q}"`).toBeTruthy();
    }
  });
});
