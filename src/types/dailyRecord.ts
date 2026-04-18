// Shared types for the Daily Record extension.
// Daily records live in the same `incidents` table; `record_type` distinguishes them.

export type RecordType = 'incident' | 'daily_record';

export const INTERACTION_TYPES = [
  'Spoke with',
  'Responded to',
  'Worked solo',
  'Worked with others',
  'Task focus',
  'Other',
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

// Stored as JSONB in the `interactions` column for daily_record rows.
export interface Interaction {
  time?: string;
  type: InteractionType | string;
  who?: string;
  context?: string;
}

// Narrow runtime guard so we can safely read JSONB from the DB.
export function isInteractionArray(v: unknown): v is Interaction[] {
  return Array.isArray(v) && v.every(item =>
    item && typeof item === 'object' && typeof (item as Interaction).type === 'string'
  );
}

export function isDailyRecord(rt: string | null | undefined): boolean {
  return rt === 'daily_record';
}
