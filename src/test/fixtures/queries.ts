/**
 * Test queries for intent classification and agent routing.
 */

export const INTENT_TEST_CASES = {
  // Should classify as "advisor" (general questions)
  advisor: [
    'What are the risks of using AI for customer support?',
    'How does GDPR apply to our AI chatbot?',
    'What governance framework should we adopt?',
    'Tell me about NIST AI RMF',
    'Is our AI system compliant with EU AI Act?',
  ],

  // Should classify as "intake" (risk assessment requests)
  intake: [
    'Assess the risk of our hiring AI tool',
    'Run an intake risk assessment for our credit scoring model',
    'Evaluate this use case: automated claims processing',
    'Perform a risk assessment on our customer segmentation AI',
    'I need an AI intake assessment for a facial recognition system',
  ],

  // Should classify as "document" (governance document generation)
  document: [
    'Generate a DPIA for our recommendation engine',
    'Create a threat model for our chatbot',
    'Write a data sheet for our ML pipeline',
    'Produce a model card for our sentiment analysis tool',
    'Generate a human oversight statement for our loan approval AI',
  ],

  // Should classify as "playbook" (implementation plan requests)
  playbook: [
    'Create a NIST AI RMF playbook for our organisation',
    'Build an implementation plan for EU AI Act compliance',
    'Generate a compliance roadmap for ISO 42001',
    'Create an implementation playbook for our AI governance',
    'I need a governance playbook for NIST compliance',
  ],
};

/** Complex queries that test edge cases */
export const EDGE_CASE_QUERIES = {
  // Ambiguous — mentions assessment but is really asking for advice
  ambiguous: 'Should we assess the risk before deploying our chatbot?',

  // Contains document keyword but is a question
  falseDocument: 'What should a DPIA contain?',

  // Contains playbook keyword but is a question
  falsePlaybook: 'What is an implementation playbook?',

  // Multi-intent — both assessment and document
  multiIntent: 'Assess our hiring AI and generate a DPIA for it',

  // Very short query
  minimal: 'AI risk?',

  // Very long query with noise
  verbose:
    'We are a mid-size financial services company based in London with 200 employees and we recently started using an AI-powered credit scoring model from a third-party vendor called ScoreAI. The model takes in applicant financial history, employment data, and some demographic information to produce a credit risk score from 0-100. Scores below 40 result in automatic rejection. We need to understand what governance requirements apply to us under GDPR, EU AI Act, and potentially FCA regulations.',
};