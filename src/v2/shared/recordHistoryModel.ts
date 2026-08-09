// Phase 7 — plain-language mapping of production `edit_history` rows.
// Pure functions so they can be unit tested without a database.
export interface EditHistoryRowLike {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  edit_source: string;
}

export interface HistoryItem {
  id: string;
  label: string;
  at: string;
  note?: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  raw_narrative: 'Written wording changed',
  category: 'Category',
  subtype: 'Subtype',
  location: 'Location',
  exact_words: 'Quoted words',
  impact_note: 'Impact note',
  incident_date: 'Event date',
  incident_time: 'Event time',
  people_involved: 'People',
  witnesses: 'People present',
};

const SOURCE_NOTES: Record<string, string> = {
  transcription: 'added from a voice record',
  system: 'set by Chronicle',
  sync: 'synced from another device',
};

const changeVerb = (oldV: string | null, newV: string | null): string => {
  const had = !!(oldV && oldV.trim());
  const has = !!(newV && newV.trim());
  if (!had && has) return 'added';
  if (had && !has) return 'removed';
  return 'changed';
};

/** True when the sealed wording itself was edited at any point. */
export const wordingWasChanged = (rows: EditHistoryRowLike[]): boolean =>
  rows.some(r => r.field_changed === 'raw_narrative');

/** Neutral, non-technical history lines, oldest first. No values are shown. */
export const toHistoryItems = (rows: EditHistoryRowLike[]): HistoryItem[] =>
  [...rows]
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    .map(r => {
      const base = FIELD_LABELS[r.field_changed] ?? r.field_changed.replace(/_/g, ' ');
      const label =
        r.field_changed === 'raw_narrative'
          ? base
          : `${base} ${changeVerb(r.old_value, r.new_value)}`;
      return {
        id: r.id,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        at: r.changed_at,
        note: SOURCE_NOTES[r.edit_source] ?? null,
      };
    });
