# V1 → V2 migration strategy

Contract and types: `src/v2/model/migration.ts`. **Nothing has been run against
real user data.**

## Shape of the migration

Three stages, always in this order:

```text
1. SNAPSHOT   read-only copy of the V1 local DB + a server-side export
2. DRY RUN    plan every row, produce a MigrationReport, write nothing
3. WRITE      apply the same plan into the V2 store, idempotently
```

The V1 database (`chronicle_local`) and the V1 Postgres tables are **never
written to or deleted** by the migration. V2 writes into its own store. V1
remains fully usable throughout, which is also the rollback path.

## Guarantees

- **Deterministic** — the plan is a pure function of the input rows. No
  generated titles, no invented timestamps, no reordering.
- **Idempotent** — records already carrying `migrated_from_v1` in their history
  are counted as `records_skipped_already_migrated` and left untouched.
- **Verbatim** — `raw_narrative` is copied byte-for-byte into
  `original.text`. No trimming, no reflowing, no summarising.
- **Nothing dropped silently** — anything the V2 model cannot hold is recorded
  in `report.unmapped` with a value preview.

## Field mapping

Single source of truth: the `FIELD_MAPPING` table in
`src/v2/model/migration.ts`. Highlights:

- `incidents.id` → `V2Record.id` (identity preserved).
- `original_created_at ?? created_at` → `captured_at`; `created_at` → `sealed_at`
  (V1 had no seal concept; creation time is the closest honest equivalent, and
  the history event records that it was derived).
- `record_type = 'daily'` → `kind: 'daily'`, using `record_date` for the event
  date; everything else becomes `kind: 'incident'`.
- `people_involved` + `witnesses` → `V2Person` rows keyed on a normalised name;
  witness status becomes a role note, not a separate entity.
- `excluded_from_rep = true` → `dossier: { state: 'excluded' }`;
  `false` → `not_included` (V1 never recorded a positive inclusion).
- `follow_up_notes` → clarifications: `Outcome` → `outcome`,
  `Update`/`Meeting` → `follow_up`, otherwise `clarification`.
- `evidence_files` → `V2Media`; `role = 'original'` when `upload_date` is at or
  before `sealed_at`, otherwise `later`. `file_hash` is copied, never recomputed.
- `edit_history` → `V2RecordEvent` (`actor` from `edit_source`). Old text edits
  are recorded as history, never replayed onto `original`.
- `ai_summary` → `unmapped`. V2 does not present generated text as record content.

## Malformed and incomplete data

| Case | Behaviour |
|---|---|
| Empty `raw_narrative` | Migrated; `empty_narrative` warning |
| Missing date | `event_date` stays null; `missing_incident_date` warning |
| `incident_time` not `HH:MM` | Value moved to `unmapped`; `malformed_time` warning |
| Unknown category | Kept as a user category; `unknown_category` warning |
| Attachment with no parent record | Migrated unattached; `orphan_attachment` warning |
| Attachment bytes only in cloud storage | Metadata migrated, `attachment_bytes_not_local` warning, bytes fetched lazily |
| Missing `created_at` | Skipped as `records_skipped_invalid` with an error entry |

## Report

`MigrationReport` in `src/v2/model/migration.ts` carries: records inspected,
migrated, skipped (already migrated vs invalid), clarifications created, media
linked, people created/merged, history events created, per-field transform
counts with the rule applied, warnings, errors and unmapped values.

Dry-run output is shown to the user before any write, and stored so the write
run can be diffed against it.

## Rollback and backup

1. Before the write stage, a JSON export of the V1 local DB is offered as a
   download and stored under a `v2_migration_backup` meta key.
2. The V1 local DB and V1 server tables are left intact.
3. Rollback = route the user back to the V1 UI. No data restoration is needed
   because nothing was moved, only copied.
4. The V1 database is only removed after a defined soak period and an explicit
   user action — never automatically, and never in this phase.
