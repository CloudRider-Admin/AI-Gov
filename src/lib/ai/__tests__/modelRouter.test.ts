import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pickAdvisorModel, pickJudgeModel } from '../modelRouter';
import type { ClassifiedIntent } from '../intentClassifier';

const advisor: ClassifiedIntent = { type: 'advisor', confidence: 'high' };
const intake: ClassifiedIntent = { type: 'intake', confidence: 'high' };
const document: ClassifiedIntent = { type: 'document', confidence: 'high', documentType: 'dpia' };
const playbook: ClassifiedIntent = { type: 'playbook', confidence: 'high', framework: 'NIST' };

describe('pickAdvisorModel', () => {
  const originalModel = process.env.OPENAI_MODEL;
  const originalJudge = process.env.OPENAI_JUDGE_MODEL;

  beforeEach(() => {
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_JUDGE_MODEL;
  });

  afterEach(() => {
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
    if (originalJudge === undefined) delete process.env.OPENAI_JUDGE_MODEL;
    else process.env.OPENAI_JUDGE_MODEL = originalJudge;
  });

  it('routes a short FAQ-shaped advisory question to gpt-4o-mini', () => {
    const choice = pickAdvisorModel({
      query: 'What is NIST AI RMF?',
      classifiedIntent: advisor,
    });
    expect(choice.model).toBe('gpt-4o-mini');
    expect(choice.tier).toBe('faq');
    expect(choice.reason).toBe('faq-question');
    expect(choice.overridden).toBe(false);
  });

  it('keeps document intent on gpt-4o regardless of length', () => {
    const choice = pickAdvisorModel({
      query: 'DPIA please',
      classifiedIntent: document,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.tier).toBe('standard');
    expect(choice.reason).toBe('intent=document');
  });

  it('keeps intake intent on gpt-4o', () => {
    const choice = pickAdvisorModel({
      query: 'intake',
      classifiedIntent: intake,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.reason).toBe('intent=intake');
  });

  it('keeps playbook intent on gpt-4o', () => {
    const choice = pickAdvisorModel({
      query: 'playbook',
      classifiedIntent: playbook,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.reason).toBe('intent=playbook');
  });

  it('routes long advisor queries to gpt-4o (length gate)', () => {
    const longQuery = 'What is GDPR? '.repeat(20); // > 240 chars
    const choice = pickAdvisorModel({
      query: longQuery,
      classifiedIntent: advisor,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.reason).toMatch(/^length>/);
  });

  it('escalates queries with high-stakes markers to gpt-4o', () => {
    const choice = pickAdvisorModel({
      query: 'What is a DPIA?',
      classifiedIntent: advisor,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.reason).toBe('high-stakes-marker');
  });

  it('escalates breach/incident queries to gpt-4o', () => {
    const choice = pickAdvisorModel({
      query: 'How do I report a breach?',
      classifiedIntent: advisor,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.reason).toBe('high-stakes-marker');
  });

  it('escalates biometric queries to gpt-4o', () => {
    const choice = pickAdvisorModel({
      query: 'How do I evaluate facial recognition?',
      classifiedIntent: advisor,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.reason).toBe('high-stakes-marker');
  });

  it('routes non-question-shaped queries to gpt-4o', () => {
    const choice = pickAdvisorModel({
      query: 'I would like advice on governance.',
      classifiedIntent: advisor,
    });
    expect(choice.model).toBe('gpt-4o');
    expect(choice.reason).toBe('not-question-shaped');
  });

  it('honors OPENAI_MODEL env override across all branches', () => {
    process.env.OPENAI_MODEL = 'gpt-4-test';
    const fromFaq = pickAdvisorModel({
      query: 'What is NIST AI RMF?',
      classifiedIntent: advisor,
    });
    expect(fromFaq.model).toBe('gpt-4-test');
    expect(fromFaq.reason).toBe('env-override');
    expect(fromFaq.overridden).toBe(true);

    const fromDoc = pickAdvisorModel({
      query: 'generate a DPIA for hiring AI',
      classifiedIntent: document,
    });
    expect(fromDoc.model).toBe('gpt-4-test');
    expect(fromDoc.overridden).toBe(true);
  });
});

describe('pickJudgeModel', () => {
  const originalJudge = process.env.OPENAI_JUDGE_MODEL;

  beforeEach(() => {
    delete process.env.OPENAI_JUDGE_MODEL;
  });

  afterEach(() => {
    if (originalJudge === undefined) delete process.env.OPENAI_JUDGE_MODEL;
    else process.env.OPENAI_JUDGE_MODEL = originalJudge;
  });

  it('defaults the rubric judge to gpt-4o-mini', () => {
    const choice = pickJudgeModel();
    expect(choice.model).toBe('gpt-4o-mini');
    expect(choice.tier).toBe('faq');
    expect(choice.overridden).toBe(false);
  });

  it('honors OPENAI_JUDGE_MODEL override', () => {
    process.env.OPENAI_JUDGE_MODEL = 'gpt-judge-test';
    const choice = pickJudgeModel();
    expect(choice.model).toBe('gpt-judge-test');
    expect(choice.overridden).toBe(true);
    expect(choice.reason).toBe('judge-env-override');
  });
});
