// Phase 1 — executable canonical contracts.
//
// These validators are deliberately storage-agnostic. No production reader,
// writer, route or UI imports this module during Phase 1.
import { z } from 'zod';
import {
  CANONICAL_CONTRACT_VERSION,
  DERIVATION_CONTRACT_VERSION,
  V2_SCHEMA_VERSION,
} from './schema';

const id = z.string().min(1);
const iso = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, { message: 'Date must be a real calendar day.' });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const jsonValue: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue),
]));

export const EventDateValueSchema = z.union([
  z.object({ kind: z.literal('exact'), date: isoDate }).strict(),
  z.object({
    kind: z.literal('approximate'),
    date: isoDate,
    daypart: z.enum(['morning', 'afternoon', 'evening', 'night']).nullable(),
  }).strict(),
  z.object({ kind: z.literal('range'), start: isoDate, end: isoDate }).strict()
    .refine(value => value.start <= value.end, { message: 'Date range must not end before it starts.' }),
  z.object({ kind: z.literal('unknown') }).strict(),
]);

export const OriginalContentSchema = z.object({
  text: z.string(),
  source: z.enum(['written', 'voice', 'written_and_voice', 'imported_v1']),
  media_ids: z.array(id),
  sealed_at: iso,
}).strict();

export const OrganisationalDetailsSchema = z.object({
  title: z.string().nullable(),
  category_id: z.string().nullable(),
  context: z.string().nullable(),
  person_ids: z.array(id),
  location: z.string().nullable(),
  event_date: EventDateValueSchema.nullable(),
  event_time: hhmm.nullable(),
  revision_count: z.number().int().nonnegative(),
}).strict();

const lifecycle = z.discriminatedUnion('state', [
  z.object({ state: z.literal('sealed') }).strict(),
  z.object({ state: z.literal('archived'), archived_at: iso, reason: z.string().optional() }).strict(),
  z.object({ state: z.literal('deleted_by_user'), deleted_at: iso, purge_after: iso.optional() }).strict(),
]);

const dossierMembership = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_included') }).strict(),
  z.object({ state: z.literal('included'), included_at: iso }).strict(),
  z.object({ state: z.literal('excluded'), excluded_at: iso, reason: z.string().optional() }).strict(),
]);

const syncState = z.discriminatedUnion('state', [
  z.object({ state: z.literal('local_only') }).strict(),
  z.object({ state: z.literal('queued'), since: iso }).strict(),
  z.object({ state: z.literal('synced'), at: iso, remote_version: z.number().int().nonnegative() }).strict(),
  z.object({ state: z.literal('failed'), at: iso, attempts: z.number().int().nonnegative(), message: z.string() }).strict(),
  z.object({ state: z.literal('conflict'), detected_at: iso, remote_version: z.number().int().nonnegative() }).strict(),
]);

const syncMetadata = z.object({
  remote_version: z.number().int().nonnegative().nullable(),
  local_revision: z.number().int().nonnegative(),
  state: syncState,
  last_attempt_at: iso.nullable(),
}).strict();

export const V2RecordSchema = z.object({
  id,
  owner_id: id,
  kind: z.enum(['incident', 'daily']),
  schema_version: z.literal(V2_SCHEMA_VERSION),
  original: OriginalContentSchema,
  details: OrganisationalDetailsSchema,
  lifecycle,
  dossier: dossierMembership,
  captured_at: iso,
  sealed_at: iso,
  created_at: iso,
  updated_at: iso,
  sync: syncMetadata,
}).strict().superRefine((record, ctx) => {
  if (record.original.sealed_at !== record.sealed_at) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['original', 'sealed_at'], message: 'Original and record seal timestamps must agree.' });
  }
});

export const V2MediaSchema = z.object({
  id,
  record_id: id,
  owner_id: id,
  kind: z.enum(['voice', 'image', 'document', 'audio', 'video', 'other']),
  role: z.enum(['original', 'later', 'legacy_unresolved']),
  name: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative().nullable(),
  description: z.string().nullable(),
  added_at: iso,
  inclusion: z.discriminatedUnion('state', [
    z.object({ state: z.literal('included') }).strict(),
    z.object({ state: z.literal('excluded_from_dossier'), excluded_at: iso, reason: z.string().optional() }).strict(),
  ]),
  storage: z.discriminatedUnion('location', [
    z.object({ location: z.literal('local'), ok: z.boolean() }).strict(),
    z.object({ location: z.literal('local_and_remote'), remote_path: z.string().min(1), uploaded_at: iso }).strict(),
    z.object({ location: z.literal('remote_only'), remote_path: z.string().min(1) }).strict(),
    z.object({ location: z.literal('missing'), detected_at: iso }).strict(),
  ]),
  content_hash: z.string().nullable(),
  sync: syncMetadata,
}).strict();

export const V2ProposalSchema = z.object({
  id,
  owner_id: id,
  record_id: id,
  kind: z.enum(['category', 'context', 'event_date', 'person', 'organisation']),
  proposed_value: jsonValue,
  source: z.object({ helper: z.string().min(1), helper_version: z.string().min(1), model: z.string().nullable() }).strict(),
  created_at: iso,
  state: z.discriminatedUnion('state', [
    z.object({ state: z.literal('proposed') }).strict(),
    z.object({ state: z.literal('accepted'), resolved_at: iso, accepted_value: jsonValue }).strict(),
    z.object({ state: z.literal('dismissed'), resolved_at: iso }).strict(),
    z.object({ state: z.literal('superseded'), resolved_at: iso, superseded_by_id: id }).strict(),
  ]),
}).strict();

export const V2RecordRelationshipSchema = z.object({
  id,
  owner_id: id,
  record_id: id,
  entity_type: z.enum(['person', 'organisation']),
  entity_id: id,
  role_note: z.string().nullable(),
  source: z.enum(['user', 'accepted_proposal', 'migration']),
  created_at: iso,
  removed_at: iso.nullable(),
}).strict();

export const V2DerivedObjectSchema = z.object({
  id,
  owner_id: id,
  record_id: id,
  kind: z.enum(['search_index', 'embedding', 'entity_candidates', 'ranking_cache']),
  source_record_version: z.number().int().nonnegative(),
  derivation_version: z.literal(DERIVATION_CONTRACT_VERSION),
  created_at: iso,
  value: jsonValue,
}).strict();

/** Only these operations may mutate a sealed canonical record. */
export const CanonicalRecordMutationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('update_details'),
    owner_id: id,
    record_id: id,
    expected_revision: z.number().int().nonnegative(),
    patch: OrganisationalDetailsSchema.partial().omit({ revision_count: true }).strict(),
  }).strict(),
  z.object({
    kind: z.literal('append_clarification'),
    owner_id: id,
    record_id: id,
    clarification_id: id,
    clarification_kind: z.enum(['clarification', 'follow_up', 'outcome', 'correction']),
    text: z.string(),
    created_at: iso,
  }).strict(),
  z.object({
    kind: z.literal('set_dossier_membership'),
    owner_id: id,
    record_id: id,
    membership: dossierMembership,
  }).strict(),
  z.object({ kind: z.literal('archive_record'), owner_id: id, record_id: id, reason: z.string().optional() }).strict(),
  z.object({ kind: z.literal('restore_record'), owner_id: id, record_id: id }).strict(),
]);

export const MigrationRowOutcomeSchema = z.object({
  source: z.enum(['incident', 'note', 'evidence', 'history']),
  source_id: id,
  record_id: z.string().nullable(),
  disposition: z.enum(['mapped', 'retained_unlinked', 'skipped', 'reported']),
  reason: z.string().min(1),
}).strict();

const migrationWarningCode = z.enum([
  'missing_incident_date', 'empty_narrative', 'unknown_category', 'malformed_time',
  'duplicate_person_name', 'orphan_attachment', 'orphan_follow_up_note',
  'orphan_edit_history', 'attachment_bytes_not_local',
]);
const migrationCount = z.number().int().nonnegative();

export const MigrationPlanResultSchema = z.object({
  report: z.object({
    migration_id: z.string().min(1),
    phase: z.enum(['dry_run', 'write']),
    started_at: iso,
    finished_at: iso.nullable(),
    counts: z.object({
      records_inspected: migrationCount,
      records_migrated: migrationCount,
      records_skipped_already_migrated: migrationCount,
      records_skipped_invalid: migrationCount,
      clarifications_created: migrationCount,
      media_linked: migrationCount,
      people_created: migrationCount,
      people_merged: migrationCount,
      history_events_created: migrationCount,
    }).strict(),
    fields_transformed: z.array(z.object({ field: z.string(), count: migrationCount, rule: z.string() }).strict()),
    warnings: z.array(z.object({ record_id: z.string().nullable(), code: migrationWarningCode, detail: z.string() }).strict()),
    errors: z.array(z.object({ record_id: z.string().nullable(), message: z.string() }).strict()),
    unmapped: z.array(z.object({ record_id: z.string().nullable(), field: z.string(), value_preview: z.string() }).strict()),
  }).strict(),
  plans: z.array(z.object({
    id,
    action: z.enum(['migrate', 'skip_already_migrated', 'skip_invalid']),
  }).strict()),
  rowOutcomes: z.array(MigrationRowOutcomeSchema),
  warningsByClass: z.object({ safe: migrationCount, requires_handling: migrationCount, blocker: migrationCount }).strict(),
}).strict().superRefine((result, ctx) => {
  const keys = result.rowOutcomes.map(row => `${row.source}:${row.source_id}`);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rowOutcomes'], message: 'Every source row must have exactly one outcome.' });
  }
});

export const ContractEnvelopeSchema = z.object({
  contract_version: z.literal(CANONICAL_CONTRACT_VERSION),
  schema_version: z.literal(V2_SCHEMA_VERSION),
  payload: z.unknown(),
}).strict();
