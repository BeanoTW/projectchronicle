// Phase 8 — full V1 → V2 migration dry run.
//
// Pure and side-effect free. Nothing here reads or writes a database: callers
// pass a snapshot in, a report comes out. The V1 store is never touched.
//
// Terminology note: "dossier" below is the INTERNAL/legacy name for what the
// product now calls "My Record". Persistence fields are intentionally unchanged.

import { emptyReport, planRecord, type MigrationReport, type MigrationWarning, type V1IncidentLike } from './migration';

export interface V1Note {
  id: string;
  incident_id: string;
  note_text: string;
  note_type: string | null;
  created_at: string;
}

export interface V1Evidence {
  id: string;
  incident_id: string | null;
  file_name: string;
  file_path: string;
  file_hash: string | null;
  mime_type: string | null;
  upload_date: string;
}

export interface V1EditHistory {
  id: string;
  incident_id: string;
  field_changed: string;
  changed_at: string;
  edit_source: string | null;
}

/** Everything a dry run inspects. Extra V1 columns arrive on `incidents`. */
export interface V1Snapshot {
  incidents: Array<V1IncidentLike & Record<string, unknown>>;
  notes: V1Note[];
  evidence: V1Evidence[];
  history: V1EditHistory[];
}

/** Columns the V2 model deliberately does not carry over. */
export const KNOWN_UNMAPPED_FIELDS = ['ai_summary', 'severity', 'tags', 'status', 'locked'] as const;

/** Every V1 incident column the planner knows about (mapped or deliberately not). */
const RECOGNISED_FIELDS = new Set<string>([
  'id', 'user_id', 'raw_narrative', 'record_type', 'incident_date', 'record_date', 'incident_time',
  'category', 'subtype', 'context_domain', 'category_source', 'location', 'title', 'exact_words',
  'impact_note', 'people_involved', 'witnesses', 'created_at', 'updated_at', 'original_created_at',
  'last_modified_at', 'excluded_from_rep', 'record_method', 'interactions', 'version', 'voided_at',
  'void_reason', 'transcription_source_attachment_id', 'transcription_created_at',
  'transcription_provider', 'transcription_model',
  ...KNOWN_UNMAPPED_FIELDS,
]);

export type WarningClass = 'safe' | 'requires_handling' | 'blocker';

/** Stable classification so a dry run never leaves a warning unexplained. */
export const WARNING_CLASS: Record<MigrationWarning['code'], WarningClass> = {
  missing_incident_date: 'safe',            // V1 allowed it; V2 keeps event_date null
  empty_narrative: 'safe',                  // incomplete record, migrated as details-only
  unknown_category: 'safe',                 // preserved as a user category
  malformed_time: 'requires_handling',      // value is kept in `unmapped`, never dropped
  duplicate_person_name: 'safe',            // de-duplicated per owner
  orphan_attachment: 'requires_handling',   // evidence with no parent record
  orphan_follow_up_note: 'requires_handling',
  orphan_edit_history: 'safe',              // history without a record is not replayed
  attachment_bytes_not_local: 'safe',       // bytes stay in storage; reference is migrated
};

export interface MigrationPlanResult {
  report: MigrationReport;
  /** Deterministic per-record decisions, sorted by record id. */
  plans: Array<{ id: string; action: 'migrate' | 'skip_already_migrated' | 'skip_invalid' }>;
  warningsByClass: Record<WarningClass, number>;
}

const inc = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

/**
 * Deterministic dry run. Same snapshot in → byte-identical report out
 * (apart from the caller-supplied timestamps).
 */
export const planMigration = (
  snapshot: V1Snapshot,
  opts: { alreadyMigratedIds?: ReadonlySet<string>; now?: string } = {},
): MigrationPlanResult => {
  const now = opts.now ?? '1970-01-01T00:00:00.000Z';
  const already = opts.alreadyMigratedIds ?? new Set<string>();
  const report = emptyReport('dry_run', now);

  const incidents = [...snapshot.incidents].sort((a, b) => a.id.localeCompare(b.id));
  const recordIds = new Set(incidents.map(i => i.id));
  const migratedIds = new Set<string>();
  const transformed = new Map<string, number>();
  const plans: MigrationPlanResult['plans'] = [];

  const people = new Set<string>();
  let peopleMerged = 0;

  for (const row of incidents) {
    report.counts.records_inspected += 1;
    const { action, warnings } = planRecord(row, already);
    plans.push({ id: row.id, action });
    report.warnings.push(...warnings);

    if (action === 'skip_already_migrated') {
      report.counts.records_skipped_already_migrated += 1;
      continue;
    }
    if (action === 'skip_invalid') {
      report.counts.records_skipped_invalid += 1;
      report.errors.push({ record_id: row.id, message: 'No created_at; record cannot be placed in time.' });
      continue;
    }

    report.counts.records_migrated += 1;
    migratedIds.add(row.id);

    // ---- field transforms (counted, never guessed) ----
    inc(transformed, 'raw_narrative → original.text');
    inc(transformed, 'id → V2Record.id');
    inc(transformed, 'created_at → sealed_at');
    if (row.original_created_at) inc(transformed, 'original_created_at → captured_at');
    inc(transformed, 'record_type → kind');
    if (row.category) inc(transformed, 'category → details.category_id');
    if (row.incident_date || row.record_date) inc(transformed, 'incident_date|record_date → details.event_date');
    if (row.incident_time) inc(transformed, 'incident_time → details.event_time');
    inc(transformed, 'excluded_from_rep → dossier (My Record) membership');

    // ---- people (normalised + de-duplicated per owner) ----
    const names = [...(row.people_involved ?? []), ...(row.witnesses ?? [])]
      .map(n => n.trim())
      .filter(Boolean);
    const seenHere = new Set<string>();
    for (const n of names) {
      const key = n.toLowerCase();
      if (seenHere.has(key)) {
        peopleMerged += 1;
        report.warnings.push({ record_id: row.id, code: 'duplicate_person_name', detail: `"${n}" listed twice on one record; merged.` });
        continue;
      }
      seenHere.add(key);
      if (people.has(key)) peopleMerged += 1;
      else people.add(key);
      inc(transformed, 'people_involved|witnesses → V2Person');
    }

    // ---- deliberately not carried over ----
    for (const f of KNOWN_UNMAPPED_FIELDS) {
      const v = (row as Record<string, unknown>)[f];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      report.unmapped.push({ record_id: row.id, field: `incidents.${f}`, value_preview: String(v).slice(0, 40) });
    }
    // ---- columns from a newer/older schema the planner has never seen ----
    for (const key of Object.keys(row)) {
      if (RECOGNISED_FIELDS.has(key)) continue;
      report.unmapped.push({ record_id: row.id, field: `incidents.${key}`, value_preview: String((row as Record<string, unknown>)[key]).slice(0, 40) });
    }
    if (row.incident_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.incident_time)) {
      report.unmapped.push({ record_id: row.id, field: 'incidents.incident_time', value_preview: row.incident_time });
    }
  }

  report.counts.people_created = people.size;
  report.counts.people_merged = peopleMerged;

  // ---- clarifications (follow-up notes) ----
  for (const n of [...snapshot.notes].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!recordIds.has(n.incident_id)) {
      report.warnings.push({ record_id: n.incident_id, code: 'orphan_follow_up_note', detail: `Note ${n.id} has no parent record; not migrated.` });
      continue;
    }
    if (!migratedIds.has(n.incident_id)) continue;   // parent skipped → note follows the parent
    report.counts.clarifications_created += 1;
    inc(transformed, 'follow_up_notes → V2Clarification');
  }

  // ---- evidence (references only; bytes are never moved by the planner) ----
  for (const e of [...snapshot.evidence].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!e.incident_id || !recordIds.has(e.incident_id)) {
      report.warnings.push({ record_id: e.incident_id, code: 'orphan_attachment', detail: `Evidence ${e.id} has no parent record; reference kept, not linked.` });
      continue;
    }
    if (!migratedIds.has(e.incident_id)) continue;
    report.counts.media_linked += 1;
    inc(transformed, 'evidence_files → V2Media reference');
    if (!e.file_hash) {
      report.warnings.push({ record_id: e.incident_id, code: 'attachment_bytes_not_local', detail: `Evidence ${e.id} has no stored hash; reference migrated as-is.` });
    }
  }

  // ---- edit history ----
  for (const h of [...snapshot.history].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!recordIds.has(h.incident_id)) {
      report.warnings.push({ record_id: h.incident_id, code: 'orphan_edit_history', detail: `History ${h.id} has no parent record; not replayed.` });
      continue;
    }
    if (!migratedIds.has(h.incident_id)) continue;
    report.counts.history_events_created += 1;
    inc(transformed, 'edit_history → V2RecordEvent');
  }

  report.fields_transformed = Array.from(transformed.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([field, count]) => ({ field, count, rule: 'see FIELD_MAPPING' }));

  report.warnings.sort((a, b) => `${a.record_id}${a.code}${a.detail}`.localeCompare(`${b.record_id}${b.code}${b.detail}`));
  report.unmapped.sort((a, b) => `${a.record_id}${a.field}`.localeCompare(`${b.record_id}${b.field}`));
  report.finished_at = now;

  const warningsByClass: Record<WarningClass, number> = { safe: 0, requires_handling: 0, blocker: 0 };
  report.warnings.forEach(w => { warningsByClass[WARNING_CLASS[w.code]] += 1; });

  return { report, plans, warningsByClass };
};
