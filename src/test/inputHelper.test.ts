import { describe, expect, it } from 'vitest';
import { helperSealState, INPUT_HELPER_VERSION, structureSuggestions } from '@/chronicle/shared/inputHelper';

describe('Phase 5 — Input Helper integrity', () => {
  it('does not offer assistance for short ordinary text', () => {
    expect(structureSuggestions('A short note about what happened.')).toEqual([]);
  });

  it('only restructures existing wording and does not add factual characters', () => {
    const raw = 'First thing happened. Second thing happened. Third thing happened. '.repeat(5).trim();
    const suggestion = structureSuggestions(raw)[0];
    expect(suggestion).toBeDefined();
    const stripWhitespace = (value: string) => value.replace(/\s/g, '');
    expect(stripWhitespace(suggestion.text)).toBe(stripWhitespace(raw));
  });

  it('records the exact interaction states without treating shown as accepted', () => {
    expect(helperSealState({ shown: false, interacted: false, acceptedSuggestionCount: 0 }).interactionState).toBe('NOT_SHOWN');
    expect(helperSealState({ shown: true, interacted: false, acceptedSuggestionCount: 0 }).interactionState).toBe('SHOWN_NO_INTERACTION');
    expect(helperSealState({ shown: true, interacted: true, acceptedSuggestionCount: 0 }).interactionState).toBe('INTERACTED_NO_ACCEPTANCE');
    expect(helperSealState({ shown: true, interacted: true, acceptedSuggestionCount: 2 })).toEqual({
      interactionState: 'SUGGESTION_ACCEPTED',
      acceptedSuggestionCount: 2,
      helperVersion: INPUT_HELPER_VERSION,
    });
  });
});
