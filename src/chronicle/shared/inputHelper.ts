import type { CaptureInputHelperState } from './captureModel';

export const INPUT_HELPER_VERSION = 'structure-helper/1.0';

export interface StructureSuggestion {
  id: string;
  label: string;
  text: string;
}

/**
 * Conservative, local structure assistance. It only changes presentation of
 * the user's existing characters: whitespace and sentence/paragraph breaks.
 * It never adds facts, labels an incident, summarises, or interprets meaning.
 */
export const structureSuggestions = (raw: string): StructureSuggestion[] => {
  const text = raw.trim();
  if (text.length < 180) return [];

  const suggestions: StructureSuggestion[] = [];
  const sentenceStructured = text
    .replace(/([.!?])\s+(?=[A-Z0-9“"'])/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n');
  if (sentenceStructured !== text) {
    suggestions.push({ id: 'paragraph-breaks', label: 'Separate sentences into paragraphs', text: sentenceStructured });
  }

  // For long unbroken text without useful sentence punctuation, offer only a
  // whitespace-normalised version. Do not invent punctuation or boundaries.
  if (!suggestions.length && text.length >= 320) {
    const normalised = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    if (normalised !== text) suggestions.push({ id: 'tidy-spacing', label: 'Tidy spacing', text: normalised });
  }
  return suggestions;
};

export const helperSealState = (opts: {
  shown: boolean;
  interacted: boolean;
  acceptedSuggestionCount: number;
}): CaptureInputHelperState => ({
  interactionState: opts.acceptedSuggestionCount > 0
    ? 'SUGGESTION_ACCEPTED'
    : opts.interacted
      ? 'INTERACTED_NO_ACCEPTANCE'
      : opts.shown
        ? 'SHOWN_NO_INTERACTION'
        : 'NOT_SHOWN',
  ...(opts.acceptedSuggestionCount > 0 ? { acceptedSuggestionCount: opts.acceptedSuggestionCount } : {}),
  helperVersion: INPUT_HELPER_VERSION,
});
