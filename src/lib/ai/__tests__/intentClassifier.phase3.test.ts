import { describe, expect, it } from 'vitest';

import { classifyIntent } from '../intentClassifier';

describe('intentClassifier — Phase 3', () => {
  describe('Framework detection (playbook intent)', () => {
    it('routes "Generate an AI Chef playbook for our 200-person SaaS rollout" to GovSecure AI Chef', () => {
      const intent = classifyIntent(
        'Generate an AI Chef playbook for our 200-person SaaS deployment with three customer-facing AI products.',
        false,
      );
      expect(intent.type).toBe('playbook');
      expect(intent.framework).toBe('GovSecure AI Chef');
    });

    it('routes "Build a 90-day blueprint for our healthcare AI rollout" to GovSecure 90-Day Blueprint', () => {
      const intent = classifyIntent(
        'Build a 90-day blueprint for our healthcare AI rollout starting next quarter.',
        false,
      );
      expect(intent.type).toBe('playbook');
      expect(intent.framework).toBe('GovSecure 90-Day Blueprint');
    });

    it('still routes "Generate a NIST AI RMF playbook" to NIST AI RMF', () => {
      const intent = classifyIntent(
        'Generate a NIST AI RMF governance playbook for our customer-facing chatbot deployment.',
        false,
      );
      expect(intent.type).toBe('playbook');
      expect(intent.framework).toBe('NIST AI RMF');
    });
  });

  describe('Phase 3 document types', () => {
    it('routes "Generate a TPRM questionnaire for our shortlisted vendors" to govsecure-tprm', () => {
      const intent = classifyIntent(
        'Generate a TPRM questionnaire for our shortlisted GenAI vendor procurement deployment.',
        false,
      );
      expect(intent.type).toBe('document');
      expect(intent.documentType).toBe('govsecure-tprm');
    });

    it('routes "Generate a NIST AI RMF Risk Control Matrix" to govsecure-nist-rcm', () => {
      const intent = classifyIntent(
        'Generate a NIST AI RMF Risk Control Matrix for our portfolio review deployment.',
        false,
      );
      expect(intent.type).toBe('document');
      expect(intent.documentType).toBe('govsecure-nist-rcm');
    });
  });
});
