// Chronicle V2 (candidate) — V1 → V2 migration contract.
//
// STATUS: design only. Nothing here runs against production data. These are
// the types and the deterministic rules the migration will follow, plus a
// pure dry-run planner that can be unit tested with fixtures later.
//
// Guarantees the implementation must keep:
//   * Idempotent — running twice produces the same result and no duplicates.
//   * Deterministic — same input, same output, no timestamps invented.
//   * Non-destructive — the V1 database is never written to or deleted.
//   * Verbatim — user wording is never rewritten, trimmed or reformatted.

import type { Iso, Uuid } from './schema';

export const MIGRATION_ID = 'v1_to_v2_001';

export type MigrationPhase = 'dry_run' | 'write';

export interface MigrationWarning {
  record_id: Uuid | null;
  code:
    | 'missing_incident_date'
    | 'empty_narrative'
    | 'unknown_category'
    | 'malformed_time'
    | 'duplicate_person_name'
    | 'orphan_attachment'
    | 'orphan_follow_up_note'
    | 'orphan_edit_history'
    | 'attachment_bytes_not_local';
  detail: string;
}

export interface MigrationError {
  record_id: Uuid | null;
  message: string;
}

/** Returned by both dry runs and real runs. */
export interface MigrationReport {
  migration_id: string;
  phase: MigrationPhase;
  started_at: Iso;
  finished_at: Iso | null;
  counts: {
    records_inspected: number;
    records_migrated: number;
    records_skipped_already_migrated: number;
    records_skipped_invalid: number;
    clarifications_created: number;
    media_linked: number;
    people_created: number;
    people_merged: number;
    history_events_created: number;
  };
  fields_transformed: Array<{ field: string; count: number; rule: string }>;
  warnings: MigrationWarning[];
  errors: MigrationError[];
  /** Anything the V2 model has no home for — recorded, never silently dropped. */
  unmapped: Array<{ record_id: Uuid | null; field: string; value_preview: string }>;
}

export const emptyReport = (phase: MigrationPhase, startedAt: Iso): MigrationReport => ({
  migration_id: MIGRATION_ID,
  phase,
  started_at: startedAt,
  finished_at: null,
  counts: {
    records_inspected: 0,
    records_migrated: 0,
    records_skipped_already_migrated: 0,
    records_skipped_invalid: 0,
    clarifications_created: 0,
    media_linked: 0,
    people_created: 0,
    people_merged: 0,
    history_events_created: 0,
  },
  fields_transformed: [],
  warnings: [],
  errors: [],
  unmapped: [],
});

/**
 * Field mapping rules, stated once so the implementation and the
 * documentation cannot drift apart.
 */
export const FIELD_MAPPING = [
  { from: 'incidents.id', to: 'V2Record.id', rule: 'reused verbatim — record identity is preserved' },
  { from: 'incidents.raw_narrative', to: 'V2Record.original.text', rule: 'copied byte-for-byte, never trimmed or reflowed' },
  { from: 'incidents.original_created_at | created_at', to: 'V2Record.captured_at', rule: 'first non-null wins' },
  { from: 'incidents.created_at', to: 'V2Record.sealed_at', rule: 'V1 had no seal concept; creation time is the closest honest equivalent' },
  { from: 'incidents.record_type', to: 'V2Record.kind', rule: "'daily' or legacy 'daily_record' → 'daily', everything else → 'incident'" },
  { from: 'incidents.title', to: 'details.title', rule: 'copied; null stays null (no generated titles)' },
  { from: 'incidents.category / subtype', to: 'details.category_id', rule: 'slugified against the V2 category table; unmatched values are kept as user categories and warned' },
  { from: 'incidents.incident_date / record_date', to: 'details.event_date', rule: "record_date wins for daily records; valid values become { kind: 'exact' }; missing dates warn and stay null" },
  { from: 'incidents.incident_time', to: 'details.event_time', rule: 'kept if it parses as HH:MM, otherwise moved to unmapped with a warning' },
  { from: 'incidents.people_involved + witnesses', to: 'V2Person + details.person_ids', rule: 'normalised names de-duplicated per owner; witness status recorded as a role note, never a separate concept' },
  { from: 'incidents.excluded_from_rep', to: 'V2Record.dossier', rule: "true → { state: 'excluded' }, false → { state: 'not_included' } (V1 had no explicit inclusion)" },
  { from: 'incidents.locked / status', to: 'V2RecordEvent', rule: 'recorded as history events; V2 has no lock concept because records are sealed by default' },
  { from: 'incidents.ai_summary', to: 'unmapped', rule: 'not carried over — V2 does not present generated text as record content' },
  { from: 'follow_up_notes.note_type', to: 'V2Clarification.kind', rule: "'Outcome' → 'outcome', 'Update'/'Meeting' → 'follow_up', anything else → 'clarification'" },
  { from: 'follow_up_notes.created_at', to: 'V2Clarification.created_at', rule: 'preserved exactly; ordering is by this value' },
  { from: 'evidence_files.*', to: 'V2Media', rule: "role = 'legacy_unresolved' unless source history proves the file was present at seal or added later; timing proximity is not proof" },
  { from: 'evidence_files.file_hash', to: 'V2Media.content_hash', rule: 'copied when present; never recomputed during migration' },
  { from: 'edit_history.*', to: 'V2RecordEvent', rule: "action 'details_updated' with actor from edit_source; original text edits are recorded but never replayed" },
] as const;

/** Minimal shape the planner needs from a V1 incident row. */
export interface V1IncidentLike {
  id: string;
  raw_narrative: string | null;
  record_type: string | null;
  incident_date: string | null;
  record_date: string | null;
  incident_time: string | null;
  category: string | null;
  created_at: string;
  original_created_at: string | null;
  excluded_from_rep: boolean | null;
  people_involved: string[] | null;
  witnesses: string[] | null;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Pure, side-effect-free validation pass. Produces the warnings and skip
 * decisions a dry run reports before anything is written.
 */
export const planRecord = (
  row: V1IncidentLike,
  alreadyMigratedIds: ReadonlySet<string>,
): { action: 'migrate' | 'skip_already_migrated' | 'skip_invalid'; warnings: MigrationWarning[] } => {
  const warnings: MigrationWarning[] = [];
  if (alreadyMigratedIds.has(row.id)) {
    return { action: 'skip_already_migrated', warnings };
  }
  const text = row.raw_narrative ?? '';
  if (text.trim().length === 0) {
    warnings.push({ record_id: row.id, code: 'empty_narrative', detail: 'No original wording; migrated as a record with details only.' });
  }
  const isDaily = row.record_type === 'daily' || row.record_type === 'daily_record';
  const eventDate = isDaily ? (row.record_date ?? row.incident_date) : row.incident_date;
  if (!eventDate) {
    warnings.push({ record_id: row.id, code: 'missing_incident_date', detail: 'No usable event date; details.event_date left null.' });
  }
  if (row.incident_time && !TIME_RE.test(row.incident_time)) {
    warnings.push({ record_id: row.id, code: 'malformed_time', detail: `Time "${row.incident_time}" is not HH:MM; moved to unmapped.` });
  }
  if (!row.created_at) {
    return { action: 'skip_invalid', warnings };
  }
  return { action: 'migrate', warnings };
};
