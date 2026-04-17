import { describe, it, expect } from 'vitest';
import { classifyIntent, reconcileIntents, type IntentType } from '../intentClassifier';
import { INTENT_TEST_CASES, EDGE_CASE_QUERIES } from '@/test/fixtures/queries';

describe('classifyIntent', () => {
  describe('advisor queries (general questions)', () => {
    for (const query of INTENT_TEST_CASES.advisor) {
      it(`should classify "${query.slice(0, 60)}..." as advisor`, () => {
        const result = classifyIntent(query);
        expect(result.type).toBe('advisor');
      });
    }
  });

  describe('intake queries (risk assessment requests)', () => {
    for (const query of INTENT_TEST_CASES.intake) {
      it(`should classify "${query.slice(0, 60)}..." as intake`, () => {
        const result = classifyIntent(query);
        expect(result.type).toBe('intake');
      });
    }
  });

  describe('document queries (governance document generation)', () => {
    for (const query of INTENT_TEST_CASES.document) {
      it(`should classify "${query.slice(0, 60)}..." as document`, () => {
        const result = classifyIntent(query);
        expect(result.type).toBe('document');
        expect(result.documentType).toBeDefined();
      });
    }
  });

  describe('playbook queries (implementation plan requests)', () => {
    for (const query of INTENT_TEST_CASES.playbook) {
      it(`should classify "${query.slice(0, 60)}..." as playbook`, () => {
        const result = classifyIntent(query);
        expect(result.type).toBe('playbook');
      });
    }
  });

  describe('document type detection', () => {
    it('should detect DPIA document type', () => {
      const result = classifyIntent('Generate a DPIA for our recommendation engine');
      expect(result.documentType).toBe('dpia');
    });

    it('should detect threat model type', () => {
      const result = classifyIntent('Create a threat model for our chatbot');
      expect(result.documentType).toBe('threat-model');
    });

    it('should detect model card type', () => {
      const result = classifyIntent('Write a model card for our sentiment analysis tool');
      expect(result.documentType).toBe('model-card');
    });

    it('should detect data sheet type', () => {
      const result = classifyIntent('Produce a data sheet for our ML pipeline');
      expect(result.documentType).toBe('data-sheet');
    });

    it('should detect human oversight statement type', () => {
      const result = classifyIntent('Generate a human oversight statement for our loan approval AI');
      expect(result.documentType).toBe('human-oversight-statement');
    });
  });

  describe('framework detection for playbooks', () => {
    it('should detect NIST AI RMF framework', () => {
      const result = classifyIntent('Create a NIST AI RMF playbook for our organisation');
      expect(result.framework).toBe('NIST AI RMF');
    });

    it('should detect EU AI Act framework', () => {
      const result = classifyIntent('Build an implementation plan for EU AI Act compliance');
      expect(result.framework).toMatch(/EU AI Act|Combined/);
    });

    it('should detect ISO 42001 framework', () => {
      const result = classifyIntent('Generate a compliance roadmap for ISO 42001');
      expect(result.framework).toBe('ISO/IEC 42001');
    });
  });

  describe('edge cases', () => {
    it('should handle ambiguous query as advisor', () => {
      const result = classifyIntent(EDGE_CASE_QUERIES.ambiguous);
      // "Should we assess..." is a question, not a generation request
      expect(result.type).toBe('advisor');
    });

    it('should not classify "What should a DPIA contain?" as document generation', () => {
      const result = classifyIntent(EDGE_CASE_QUERIES.falseDocument);
      expect(result.type).toBe('advisor');
    });

    it('should not classify "What is an implementation playbook?" as playbook generation', () => {
      const result = classifyIntent(EDGE_CASE_QUERIES.falsePlaybook);
      expect(result.type).toBe('advisor');
    });

    it('should handle very short queries', () => {
      const result = classifyIntent(EDGE_CASE_QUERIES.minimal);
      expect(result.type).toBe('advisor');
    });

    it('should handle verbose real-world queries', () => {
      const result = classifyIntent(EDGE_CASE_QUERIES.verbose);
      // This is a description, not a generation request — should be advisor
      expect(result.type).toBe('advisor');
    });

    it('should handle empty string', () => {
      const result = classifyIntent('');
      expect(result.type).toBe('advisor');
    });
  });
});

describe('reconcileIntents', () => {
  it('should return high confidence when both agree', () => {
    const det = classifyIntent('Generate a DPIA for our chatbot');
    const llm = { type: 'document' as IntentType, documentType: 'dpia' };
    const { finalIntent, contested } = reconcileIntents(det, llm);
    expect(finalIntent.confidence).toBe('high');
    expect(contested).toBe(false);
  });

  it('should trust deterministic when it has high confidence and LLM disagrees', () => {
    const det = classifyIntent('Assess the risk of our hiring AI tool');
    const llm = { type: 'advisor' as IntentType };
    const { finalIntent, contested } = reconcileIntents(det, llm);
    expect(finalIntent.type).toBe('intake');
    expect(contested).toBe(true);
  });

  it('should trust LLM when deterministic has low confidence', () => {
    const det = classifyIntent('Help me understand our AI risks');
    expect(det.confidence).toBe('low'); // advisor with low confidence
    const llm = { type: 'intake' as IntentType };
    const { finalIntent, contested } = reconcileIntents(det, llm);
    expect(finalIntent.type).toBe('intake');
    expect(contested).toBe(false);
  });

  it('should handle missing LLM intent gracefully', () => {
    const det = classifyIntent('Generate a DPIA for our chatbot');
    const { finalIntent, contested } = reconcileIntents(det, undefined);
    expect(finalIntent.type).toBe('document');
    expect(contested).toBe(false);
  });

  it('should merge document types from both sources', () => {
    const det = classifyIntent('Create a governance document for our AI');
    const llm = { type: 'document' as IntentType, documentType: 'risk-memo' };
    const { finalIntent } = reconcileIntents(det, llm);
    // Should pick up the documentType from whichever has it
    expect(finalIntent.documentType).toBeDefined();
  });
});
