/**
 * Lightweight display-title helper (DISPLAY ONLY).
 *
 * Deterministic, non-AI logic to derive a short single-line title for cards
 * when no explicit `title` exists on a record. NEVER mutates stored data.
 *
 * Priority:
 *   1. explicit title
 *   2. exact_words
 *   3. first sentence of raw_narrative
 *   4. clean truncated narrative preview
 *   5. fallback ("Untitled incident" for incidents, "Daily record" for daily)
 *
 * Rules:
 *   - single line
 *   - clean truncation (no mid-word cuts)
 *   - no interpretation, no summarisation, no invented wording
 *   - no field labels
 */

const MAX_LEN = 80;

function cleanLine(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max = MAX_LEN): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s,;:.\-–—]+$/, '') + '…';
}

function firstSentence(s: string): string {
  const trimmed = cleanLine(s);
  if (!trimmed) return '';
  const m = trimmed.split(/(?<=[.!?])\s+/);
  return m[0] || trimmed;
}

export interface TitleSource {
  title?: string | null;
  exact_words?: string | null;
  raw_narrative?: string | null;
  record_type?: string | null;
}

/**
 * Derive a lightweight display title for a record.
 * Use only for rendering — never persist this value.
 */
export function displayTitle(rec: TitleSource): string {
  const isDaily = (rec.record_type || '') === 'daily_record';

  const explicit = cleanLine(rec.title);
  if (explicit) return truncate(explicit);

  const exact = cleanLine(rec.exact_words);
  if (exact) return truncate(exact);

  const narrative = cleanLine(rec.raw_narrative);
  if (narrative) {
    const sentence = firstSentence(narrative);
    if (sentence) return truncate(sentence);
    return truncate(narrative);
  }

  return isDaily ? 'Daily record' : 'Untitled incident';
}
