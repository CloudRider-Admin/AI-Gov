import { describe, it, expect } from 'vitest';
import { splitFollowUpChoices } from '../followUps';
import type { AdvisorResponse } from '@/types/advisor';

describe('splitFollowUpChoices (stored-message normalization)', () => {
  it('flattens raw object questions from a stored streaming response', () => {
    const raw = JSON.parse(
      JSON.stringify({
        mode: 'clarification',
        followUpQuestions: [
          { question: 'What type of AI system?', options: ['Chatbot', 'Recommendation engine', 'Other'] },
          { question: 'What is it called?', options: [] },
        ],
      }),
    ) as Partial<AdvisorResponse>;
    const out = splitFollowUpChoices(raw);
    expect(out.followUpQuestions).toEqual(['What type of AI system?', 'What is it called?']);
    expect(out.followUpQuestions!.every((q) => typeof q === 'string')).toBe(true);
    expect(out.followUpChoices).toEqual([{ options: ['Chatbot', 'Recommendation engine'], multiSelect: false }, null]);
  });

  it('keeps already-normalized responses intact', () => {
    const stored: Partial<AdvisorResponse> = {
      followUpQuestions: ['A?', 'B?'],
      followUpChoices: [{ options: ['x', 'y'], multiSelect: false }, null],
    };
    expect(splitFollowUpChoices(stored)).toBe(stored);
  });

  it('ignores responses without follow-up questions', () => {
    const stored: Partial<AdvisorResponse> = { mode: 'assessment' };
    expect(splitFollowUpChoices(stored)).toBe(stored);
  });
});
