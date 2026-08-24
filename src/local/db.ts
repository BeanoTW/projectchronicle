// Local-first storage layer (IndexedDB via Dexie).
// Records live here first; cloud backup is optional and explicit.
import Dexie, { type Table } from 'dexie';
import type { Tables } from '@/integrations/supabase/types';
import type {
  V2Clarification,
  V2Media,
  V2Person,
  V2Record,
  V2RecordEvent,
  V2RecordRelationship,
} from '@/chronicle/model/schema';

export type SyncState =
  | 'local_only'         // never attempted backup (backup OFF, or queued before activation)
  | 'queued'             // backup ON, awaiting upload
  | 'backed_up'          // upload confirmed by backend
  | 'backup_failed'      // last upload attempt failed; record still safe locally
  | 'conflict';          // server rejected upload — server row has moved on (multi-device edit)

// Local rows mirror the Supabase row shapes but add sync metadata.
// owner_user_id scopes records to the signed-in account on this device.
// `version` mirrors the server's monotonic version for conflict detection.
// When a local edit happens, version stays at the last server-known value;
// the sync engine sends it as `_expected_version` so the server can reject
// stale overwrites.
export type LocalIncident = Tables<'incidents'> & {
  owner_user_id: string;
  sync_state: SyncState;
  last_sync_attempt_at: string | null;
  last_sync_error: string | null;
  local_updated_at: string;
  conflict_detected_at?: string | null;
  cloud_last_modified_at?: string | null;
  cloud_version?: number | null;
};

export type LocalFollowUpNote = Tables<'follow_up_notes'> & {
  owner_user_id: string;
  sync_state: SyncState;
  last_sync_attempt_at: string | null;
  last_sync_error: string | null;
  local_updated_at: string;
};

export interface LocalMeta {
  key: string;
  value: string;
}

export interface QuarantinedRow {
  key: string;
  owner_user_id: string;
  kind: 'incident' | 'note';
  stored_at: string;
  payload: LocalIncident | LocalFollowUpNote;
}

/** Local bytes for canonical media. Metadata remains in `canonical_media`. */
export interface CanonicalMediaBytes {
  id: string;
  owner_id: string;
  record_id: string;
  content_hash: string;
  bytes: ArrayBuffer;
  stored_at: string;
}

export class CanonicalStorageBoundaryError extends Error {}

/**
 * Canonical stores remain parallel to the legacy tables. Schema upgrades only
 * create stores/indexes; no upgrade callback copies or rewrites V1 data.
 */
export class ChronicleDB extends Dexie {
  incidents!: Table<LocalIncident, string>;
  follow_up_notes!: Table<LocalFollowUpNote, string>;
  meta!: Table<LocalMeta, string>;
  quarantine!: Table<QuarantinedRow, string>;

  canonical_records!: Table<V2Record, string>;
  canonical_clarifications!: Table<V2Clarification, string>;
  canonical_media!: Table<V2Media, string>;
  canonical_media_bytes!: Table<CanonicalMediaBytes, string>;
  canonical_history!: Table<V2RecordEvent, string>;
  canonical_people!: Table<V2Person, string>;
  canonical_relationships!: Table<V2RecordRelationship, string>;

  constructor(name = 'chronicle_local') {
    super(name);
    this.version(1).stores({
      incidents: 'id, owner_user_id, sync_state, incident_date, updated_at',
      follow_up_notes: 'id, owner_user_id, incident_id, sync_state, created_at',
      meta: 'key',
    });
    this.version(2).stores({
      incidents: 'id, owner_user_id, sync_state, incident_date, record_date, updated_at',
    });
    this.version(3).stores({
      quarantine: 'key, owner_user_id, kind',
    });
    this.version(4).stores({
      canonical_records: 'id, owner_id, kind, updated_at',
      canonical_clarifications: 'id, owner_id, record_id, kind, created_at',
      canonical_media: 'id, owner_id, record_id, kind, role, added_at',
      canonical_history: 'id, owner_id, record_id, action, at',
    });
    // v5 — entity identity required for a lossless canonical migration.
    this.version(5).stores({
      canonical_people: 'id, owner_id, normalised_name, display_name, merged_into_id',
      canonical_relationships: 'id, owner_id, record_id, entity_type, entity_id, created_at, removed_at',
    });
    // v6 — retry-safe, offline storage for media committed at canonical seal.
    this.version(6).stores({
      canonical_media_bytes: 'id, owner_id, record_id, content_hash, stored_at',
    });

    const immutableRecordFields = new Set([
      'id', 'owner_id', 'kind', 'schema_version', 'captured_at', 'sealed_at', 'created_at',
    ]);
    this.canonical_records.hook('updating', (changes, _key, previous) => {
      for (const [field, next] of Object.entries(changes)) {
        if (field === 'original' || field.startsWith('original.')) {
          const previousValue = field === 'original'
            ? previous.original
            : field.slice('original.'.length).split('.').reduce<unknown>((value, part) => (
              value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined
            ), previous.original);
          if (JSON.stringify(next) !== JSON.stringify(previousValue)) {
            throw new CanonicalStorageBoundaryError('Sealed original content cannot be updated in storage.');
          }
        }
        if (immutableRecordFields.has(field) && JSON.stringify(next) !== JSON.stringify(previous[field as keyof V2Record])) {
          throw new CanonicalStorageBoundaryError(`Canonical ${field} cannot be updated in storage.`);
        }
      }
    });
    this.canonical_records.hook('deleting', () => {
      throw new CanonicalStorageBoundaryError('Canonical records use lifecycle state and cannot be deleted directly.');
    });
  }
}

export const localDB = new ChronicleDB();

export const META_KEYS = {
  backupEnabled: 'backup_enabled',
  hydratedFor: (userId: string) => `hydrated_for:${userId}`,
  lastRestoreAt: (userId: string) => `last_restore_at:${userId}`,
  lastBackupAt: (userId: string) => `last_backup_at:${userId}`,
} as const;

export const getMeta = async (key: string): Promise<string | null> => {
  const row = await localDB.meta.get(key);
  return row?.value ?? null;
};

export const setMeta = async (key: string, value: string): Promise<void> => {
  await localDB.meta.put({ key, value });
};

export const isBackupEnabled = async (): Promise<boolean> => {
  return (await getMeta(META_KEYS.backupEnabled)) === '1';
};

export const setBackupEnabled = async (enabled: boolean): Promise<void> => {
  await setMeta(META_KEYS.backupEnabled, enabled ? '1' : '0');
};
