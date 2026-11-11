import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  INTAKE_FIELD_PROMPTS,
  assessIntakeProfileCompleteness,
  describeIntakeProgress,
  extractIntakeProfileFromText,
  intakeChoicesFor,
  intakeFieldForQuestion,
  mergeIntakeProfile,
  type IntakeProfile,
} from '../intakeProfile';

const P = INTAKE_FIELD_PROMPTS;
const REQUEST = 'I want generate a risk assessment for my health business';
const HEADER = 'Here are the details you asked for:';

// Round 1: answers to the model's own clarifying questions.
const round1 = `${REQUEST}

${HEADER}
Q: What specific AI system or use case are you using in your health business?
A: Insurance eligibility

Q: What's driving this request for a risk assessment?
A: Customer/auditor request`;

// Round 2: answers to the intake form questions (verbatim from the bug report).
const round2 = `${REQUEST}

${HEADER}
Q: ${P.useCaseName}
A: Insurance Eligibility

Q: ${P.businessOwner}
A: Cloudrider LLC

Q: ${P.aiToolName}
A: Chatgpt 5.1 sol

Q: ${P.vendor}
A: OpenAI

Q: ${P.deploymentScope}
A: Internal-only

Q: ${P.dataCategories}
A: internal-confidential, customer/consumer, and employee/HR

Q: ${P.humanReviewMode}
A: Yes`;

const round3 = `${REQUEST}

${HEADER}
Q: ${P.humanReviewMode}
A: Always`;

function accumulate(...turns: string[]): IntakeProfile {
  return turns.reduce<IntakeProfile>((p, t) => mergeIntakeProfile(p, extractIntakeProfileFromText(t)), {});
}

describe('intakeProfile — answers to intake questions', () => {
  it('maps every intake prompt back to its field', () => {
    for (const [field, prompt] of Object.entries(P)) {
      expect(intakeFieldForQuestion(prompt)).toBe(field);
    }
    expect(intakeFieldForQuestion("What's driving this request for a risk assessment?")).toBeUndefined();
  });

  it('captures the answers, not the examples named in the question copy', () => {
    const profile = accumulate(round1, round2);
    expect(profile.useCaseName).toBe('Insurance Eligibility'); // not "Customer-Service Chatbot"
    expect(profile.businessOwner).toBe('Cloudrider LLC');
    expect(profile.aiToolName).toBe('Chatgpt 5.1 sol');
    expect(profile.vendor).toBe('OpenAI');
    expect(profile.deploymentScope).toBe('Internal'); // not "Public-facing"
    expect(profile.customerFacing).toBe(false);
    expect(profile.dataCategories).toEqual({
      internalConfidential: true,
      customerData: true,
      employeeData: true,
    }); // no sourceCodeOrCredentials / publicData from the option list
  });

  it('leaves an ambiguous "Yes" to human review unanswered, and asks only that', () => {
    const report = assessIntakeProfileCompleteness(accumulate(round1, round2));
    expect(report.missing).toEqual(['humanReviewMode']);
    expect(report.questions).toEqual([P.humanReviewMode]);
  });

  it('is complete once the human-review answer arrives', () => {
    const profile = accumulate(round1, round2, round3);
    expect(profile.humanReviewMode).toBe('Always');
    expect(assessIntakeProfileCompleteness(profile).ok).toBe(true);
  });

  it('extracts nothing from question copy alone', () => {
    const questionsOnly = Object.values(P).map((q) => `Q: ${q}\nA: `).join('\n\n');
    expect(extractIntakeProfileFromText(`${HEADER}\n${questionsOnly}`)).toEqual({});
  });

  it('normalises answers picked from the clickable choices', () => {
    const picked = `${HEADER}
Q: ${P.deploymentScope}
A: Customer-facing

Q: ${P.dataCategories}
A: Financial/regulated, Personal/sensitive

Q: ${P.humanReviewMode}
A: Sometimes

Q: ${P.vendor}
A: In-house`;
    const profile = extractIntakeProfileFromText(picked);
    expect(profile.deploymentScope).toBe('Customer-facing');
    expect(profile.dataCategories).toEqual({ financialOrRegulated: true, personalOrSensitive: true });
    expect(profile.humanReviewMode).toBe('Sometimes');
    expect(profile.vendor).toBe('In-house');
  });

  it('still reads free text outside the Q/A block', () => {
    const profile = extractIntakeProfileFromText(
      'Assess our customer-facing chatbot built on Anthropic that handles patient data',
    );
    expect(profile.deploymentScope).toBe('Customer-facing');
    expect(profile.vendor).toBe('Anthropic');
    expect(profile.dataCategories?.financialOrRegulated).toBe(true);
  });
});

describe('intakeProfile — progress message and choices', () => {
  it('says what is recorded and how much is left', () => {
    const profile = accumulate(round1, round2);
    const msg = describeIntakeProgress(profile, ['humanReviewMode']);
    expect(msg).toContain('1 more detail');
    expect(msg).toContain('Use case: Insurance Eligibility');
    expect(msg).toContain('Deployment: Internal');
    expect(msg).toContain('Data: internal-confidential, customer/consumer, employee/HR');
    expect(msg).not.toMatch(/high[- ]risk/i);
  });

  it('offers index-aligned choices for fixed-option questions only', () => {
    const choices = intakeChoicesFor(['businessOwner', 'deploymentScope', 'dataCategories', 'humanReviewMode']);
    expect(choices[0]).toBeNull();
    expect(choices[1]?.options).toEqual(['Internal-only', 'Customer-facing', 'Public-facing']);
    expect(choices[2]?.multiSelect).toBe(true);
    expect(choices[3]?.options).toEqual(['Always', 'Sometimes', 'Never']);
  });
});
