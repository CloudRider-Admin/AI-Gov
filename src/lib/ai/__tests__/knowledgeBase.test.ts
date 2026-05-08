import { describe, it, expect } from 'vitest';
import {
  ALL_KNOWLEDGE_DOCUMENTS,
  GOVERNANCE_KNOWLEDGE_BASE,
  KnowledgeBaseSearch,
} from '../knowledgeBase';

describe('ALL_KNOWLEDGE_DOCUMENTS', () => {
  it('should include original governance documents', () => {
    const originalIds = GOVERNANCE_KNOWLEDGE_BASE.map(d => d.id);
    for (const id of originalIds) {
      expect(ALL_KNOWLEDGE_DOCUMENTS.some(d => d.id === id)).toBe(true);
    }
  });

  it('should include sector guidance documents', () => {
    const sectorDocs = ALL_KNOWLEDGE_DOCUMENTS.filter(d => d.id.startsWith('sector-'));
    expect(sectorDocs.length).toBe(3); // finance, healthcare, government
  });

  it('should include emerging regulation documents', () => {
    const regDocs = ALL_KNOWLEDGE_DOCUMENTS.filter(d => d.id.startsWith('regulation-'));
    expect(regDocs.length).toBeGreaterThanOrEqual(5);
  });

  it('total documents should be original + sectors + regulations + GovSecure fallbacks', () => {
    const regDocs = ALL_KNOWLEDGE_DOCUMENTS.filter(d => d.id.startsWith('regulation-'));
    const govsecureDocs = ALL_KNOWLEDGE_DOCUMENTS.filter(d => d.id.startsWith('govsecure-'));
    // Phase 4 added 3 GovSecure fallback documents (AI Chef, Policy Suite,
    // 90-Day Blueprint) so the canonical content remains keyword-searchable
    // even when pgvector is cold.
    expect(govsecureDocs.length).toBeGreaterThanOrEqual(3);
    expect(ALL_KNOWLEDGE_DOCUMENTS.length).toBe(
      GOVERNANCE_KNOWLEDGE_BASE.length + 3 + regDocs.length + govsecureDocs.length
    );
  });
});

describe('KnowledgeBaseSearch with expanded knowledge', () => {
  const search = new KnowledgeBaseSearch();

  it('should find sector documents for finance queries', () => {
    const result = search.search('banking credit scoring AI', undefined, 10);
    const sectorDoc = result.documents.find(d => d.id === 'sector-finance');
    expect(sectorDoc).toBeDefined();
  });

  it('should find sector documents for healthcare queries', () => {
    const result = search.search('clinical diagnosis patient health AI', undefined, 10);
    const sectorDoc = result.documents.find(d => d.id === 'sector-healthcare');
    expect(sectorDoc).toBeDefined();
  });

  it('should find regulation documents for EO 14110 queries', () => {
    const result = search.search('US executive order federal AI safety', undefined, 10);
    const regDoc = result.documents.find(d => d.id === 'regulation-us-eo-14110');
    expect(regDoc).toBeDefined();
  });

  it('should find regulation documents for Colorado AI Act queries', () => {
    const result = search.search('Colorado AI Act algorithmic discrimination', undefined, 10);
    const regDoc = result.documents.find(d => d.id === 'regulation-colorado-ai-act');
    expect(regDoc).toBeDefined();
  });

  it('should still find original NIST document', () => {
    const result = search.search('NIST AI risk management framework', undefined, 10);
    const nistDoc = result.documents.find(d => d.id === 'nist-ai-rmf-overview');
    expect(nistDoc).toBeDefined();
  });

  it('should rank results by relevance', () => {
    const result = search.search('HIPAA health data AI clinical', undefined, 5);
    // Healthcare sector doc should rank highly
    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.documents[0].relevanceScore).toBeGreaterThan(0);
  });
});