// Chronicle V2 (candidate) — canonical production data model.
//
// STATUS: design only. Nothing in this file is wired to the running V2
// preview (which still uses the simpler shapes in `src/v2/db.ts`) or to
// production Supabase. It defines the target schema that the migration in
// `src/v2/model/migration.ts` will produce.
//
// Design rules encoded here:
//  1. Original content is a separate, immutable entity from later additions.
//  2. Record identity (`id`) is stable across local and remote storage.
//  3. Clarifications and evidence are append-only.
//  4. Deletion / exclusion / archive / correction are distinct states, never
//     one boolean.
//  5. State is modelled as unions, not flags.

export type Iso = string; // ISO-8601 timestamp, always UTC
export type IsoDate = string; // YYYY-MM-DD
export type Uuid = string;

/** Stable versions used by adapters, migrations and rebuildable derivations. */
export const V2_SCHEMA_VERSION = 2;
export const CANONICAL_CONTRACT_VERSION = 1;
export const DERIVATION_CONTRACT_VERSION = 1;

/* ---------------------------------------------------------------- record */

/** Lifecycle state of a record. Mutually exclusive by design. */
export type RecordLifecycle =
  | { state: 'sealed' }
  | { state: 'archived'; archived_at: Iso; reason?: string }
  | { state: 'deleted_by_user'; deleted_at: Iso; purge_after?: Iso };

/** Why the record exists — an event, or a routine daily note. */
export type RecordKind = 'incident' | 'daily';

/** Where the wording came from at seal time. */
export type CaptureSource = 'written' | 'voice' | 'written_and_voice' | 'imported_v1';

export type InputHelperInteractionState =
  | 'NOT_SHOWN'
  | 'SHOWN_NO_INTERACTION'
  | 'INTERACTED_NO_ACCEPTANCE'
  | 'SUGGESTION_ACCEPTED';

/** Immutable seal-time metadata. Absence means provenance was not recorded. */
export interface OriginalContentProvenance {
  readonly schema_version: 1;
  readonly tracking_state: 'RECORDED' | 'NOT_RECORDED';
  readonly input_helper?: {
    readonly interaction_state: InputHelperInteractionState;
    readonly accepted_suggestion_count?: number;
    readonly helper_version?: string;
  };
}

export interface V2Record {
  readonly id: Uuid;              // stable; reused from V1 `incidents.id` on migration
  readonly owner_id: Uuid;        // auth user id
  readonly kind: RecordKind;
  readonly schema_version: number;

  /** Immutable original. Never edited, never rewritten. */
  readonly original: OriginalContent;

  /** Everything the user may revise later without touching `original`. */
  details: OrganisationalDetails;

  lifecycle: RecordLifecycle;
  dossier: DossierMembership;

  readonly captured_at: Iso;      // when composition began
  readonly sealed_at: Iso;        // when the record became immutable
  readonly created_at: Iso;
  updated_at: Iso;                // details/membership changes only

  sync: SyncMetadata;
}

export interface OriginalContent {
  /** Exact wording as typed. Empty string only when capture was voice-only. */
  readonly text: string;
  readonly source: CaptureSource;
  /** Ids of media rows with role 'original'. */
  readonly media_ids: readonly Uuid[];
  /** Set once, at seal. */
  readonly sealed_at: Iso;
  /** Optional for legacy compatibility. Absence never means "no helper used". */
  readonly provenance?: OriginalContentProvenance;
}

export type EventDaypart = 'morning' | 'afternoon' | 'evening' | 'night';

/** The user's claim about when something happened; never derived precision. */
export type EventDateValue =
  | { kind: 'exact'; date: IsoDate }
  | { kind: 'approximate'; date: IsoDate; daypart: EventDaypart | null }
  | { kind: 'range'; start: IsoDate; end: IsoDate }
  | { kind: 'unknown' };

/** User-supplied context added at or after seal. Freely correctable. */
export interface OrganisationalDetails {
  title: string | null;
  category_id: string | null;
  context: string | null;         // e.g. workplace, education
  person_ids: Uuid[];
  location: string | null;
  event_date: EventDateValue | null;
  event_time: string | null;      // HH:MM local as entered
  /** Correction trail for these fields; the original is never touched. */
  revision_count: number;
}

/* -------------------------------------------------------- clarifications */

/** Append-only additions to a sealed record. */
export type ClarificationKind =
  | 'clarification'   // more detail the user remembered
  | 'follow_up'       // something that happened afterwards
  | 'outcome'         // resolution / decision
  | 'correction';     // user states an earlier detail was wrong (never rewrites it)

export interface V2Clarification {
  id: Uuid;
  record_id: Uuid;
  owner_id: Uuid;
  kind: ClarificationKind;
  text: string;
  created_at: Iso;
  /** Present only for `kind: 'correction'` — what the user says is wrong. */
  corrects_field?: keyof OrganisationalDetails | 'original.text';
  sync: SyncMetadata;
}

/* ------------------------------------------------------------------ media */

export type MediaKind = 'voice' | 'image' | 'document' | 'audio' | 'video' | 'other';
/** Legacy role remains unresolved unless Chronicle can prove when it joined. */
export type MediaRole = 'original' | 'later' | 'legacy_unresolved';

/** Inclusion is a state, not a boolean: excluded evidence stays visible. */
export type MediaInclusion =
  | { state: 'included' }
  | { state: 'excluded_from_dossier'; excluded_at: Iso; reason?: string };

/** Where the bytes currently live. Local is authoritative until uploaded. */
export type MediaStorage =
  | { location: 'local'; ok: boolean }
  | { location: 'local_and_remote'; remote_path: string; uploaded_at: Iso }
  | { location: 'remote_only'; remote_path: string }
  | { location: 'missing'; detected_at: Iso };

export interface V2Media {
  id: Uuid;
  record_id: Uuid;
  owner_id: Uuid;
  kind: MediaKind;
  role: MediaRole;
  name: string;
  mime: string;
  size: number;
  duration_ms: number | null;     // voice/audio/video only
  description: string | null;
  added_at: Iso;                  // when it became part of the record
  inclusion: MediaInclusion;
  storage: MediaStorage;
  /** SHA-256 of the bytes, computed at add time. Integrity only — not a legal claim. */
  content_hash: string | null;
  sync: SyncMetadata;
}

/** Append-only audit of what happened to a piece of media. */
export interface V2MediaEvent {
  id: Uuid;
  media_id: Uuid;
  record_id: Uuid;
  at: Iso;
  action: 'added' | 'described' | 'excluded' | 'included' | 'removed_before_seal' | 'upload_succeeded' | 'upload_failed';
  detail: string | null;
}

/* --------------------------------------------------- people and categories */

export interface V2Person {
  id: Uuid;
  owner_id: Uuid;
  display_name: string;
  /** Lowercased, whitespace-collapsed key used for de-duplication. */
  normalised_name: string;
  role_note: string | null;
  created_at: Iso;
  merged_into_id: Uuid | null;    // soft merge; never destroys the original row
}

export interface V2Organisation {
  id: Uuid;
  owner_id: Uuid;
  display_name: string;
  normalised_name: string;
  note: string | null;
  created_at: Iso;
  merged_into_id: Uuid | null;
}

export type RelationshipEntityType = 'person' | 'organisation';
export type RelationshipSource = 'user' | 'accepted_proposal' | 'migration';

/** Optional link; canonical records remain authoritative and are never copied. */
export interface V2RecordRelationship {
  id: Uuid;
  owner_id: Uuid;
  record_id: Uuid;
  entity_type: RelationshipEntityType;
  entity_id: Uuid;
  role_note: string | null;
  source: RelationshipSource;
  created_at: Iso;
  removed_at: Iso | null;
}

/* -------------------------------------------------------------- proposals */

export type ProposalKind = 'category' | 'context' | 'event_date' | 'person' | 'organisation';
export type ProposalSource = {
  helper: string;
  helper_version: string;
  model: string | null;
};
export type ProposalState =
  | { state: 'proposed' }
  | { state: 'accepted'; resolved_at: Iso; accepted_value: unknown }
  | { state: 'dismissed'; resolved_at: Iso }
  | { state: 'superseded'; resolved_at: Iso; superseded_by_id: Uuid };

/** Proposed values have no authority until a user accepts them. */
export interface V2Proposal {
  id: Uuid;
  owner_id: Uuid;
  record_id: Uuid;
  kind: ProposalKind;
  proposed_value: unknown;
  source: ProposalSource;
  created_at: Iso;
  state: ProposalState;
}

/* ------------------------------------------------------- derived objects */

export type DerivedObjectKind = 'search_index' | 'embedding' | 'entity_candidates' | 'ranking_cache';

/** Disposable machine output. It can be rebuilt and never owns record truth. */
export interface V2DerivedObject<T = unknown> {
  id: Uuid;
  owner_id: Uuid;
  record_id: Uuid;
  kind: DerivedObjectKind;
  source_record_version: number;
  derivation_version: number;
  created_at: Iso;
  value: T;
}

export interface V2Category {
  id: string;                     // stable slug, e.g. 'communication'
  label: string;
  /** System categories ship with the app; user categories are owner-scoped. */
  origin: 'system' | 'user';
  owner_id: Uuid | null;
  retired_at: Iso | null;         // retired categories stay resolvable for old records
}

/* ---------------------------------------------------------------- dossier */

/** Membership lives on the record — one canonical source of truth. */
export type DossierMembership =
  | { state: 'not_included' }
  | { state: 'included'; included_at: Iso }
  | { state: 'excluded'; excluded_at: Iso; reason?: string };

export interface V2DossierPreferences {
  id: Uuid;
  owner_id: Uuid;
  title: string;
  subject_name: string | null;
  order: 'oldest_first' | 'newest_first';
  include_contents_page: boolean;
  include_overview: boolean;
  include_organisational_details: boolean;
  include_clarifications: boolean;
  include_record_history: boolean;
  include_attachments: boolean;
  include_voice_references: boolean;
  attachment_kinds: MediaKind[];
  updated_at: Iso;
}

export type ExportFormat = 'pdf' | 'docx' | 'print';
export type ExportOutcome =
  | { state: 'completed'; bytes: number }
  | { state: 'failed'; message: string }
  | { state: 'cancelled' };

export interface V2ExportRun {
  id: Uuid;
  owner_id: Uuid;
  format: ExportFormat;
  record_ids: Uuid[];             // exactly what was in the document
  preferences_snapshot: Omit<V2DossierPreferences, 'id' | 'owner_id' | 'updated_at'>;
  started_at: Iso;
  finished_at: Iso | null;
  outcome: ExportOutcome | null;
}

/* ------------------------------------------------------------ record history */

/** Append-only history for everything that is not the original content. */
export interface V2RecordEvent {
  id: Uuid;
  record_id: Uuid;
  owner_id: Uuid;
  at: Iso;
  action:
    | 'sealed'
    | 'input_helper_accepted'
    | 'details_updated'
    | 'clarification_added'
    | 'media_added'
    | 'media_excluded'
    | 'media_included'
    | 'dossier_included'
    | 'dossier_excluded'
    | 'archived'
    | 'restored'
    | 'migrated_from_v1';
  field: string | null;
  from_value: string | null;
  to_value: string | null;
  actor: 'user' | 'system' | 'migration';
}

/* ------------------------------------------------------------------- sync */

export type SyncState =
  | { state: 'local_only' }                                   // backup off
  | { state: 'queued'; since: Iso }
  | { state: 'synced'; at: Iso; remote_version: number }
  | { state: 'failed'; at: Iso; attempts: number; message: string }
  | { state: 'conflict'; detected_at: Iso; remote_version: number };

export interface SyncMetadata {
  /** Monotonic server version; used for optimistic concurrency. */
  remote_version: number | null;
  local_revision: number;         // bumped on every local write
  state: SyncState;
  last_attempt_at: Iso | null;
}

/**
 * Authority rules:
 *  - Local (IndexedDB) is authoritative for capture: a record exists the moment
 *    it is sealed, signed in or not, online or not.
 *  - Remote (Postgres) is authoritative for cross-device convergence: on
 *    conflict the higher `remote_version` wins and the local copy is preserved
 *    as a conflict copy rather than overwritten.
 *  - Media bytes are local-authoritative until an upload is confirmed.
 *  - Categories are remote-authoritative for system categories, local for user ones.
 */
export interface AuthorityNote { readonly _doc: 'see comment above'; }
