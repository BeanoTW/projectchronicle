// Local-first storage layer (IndexedDB via Dexie).
// Records live here first; cloud backup is optional and explicit.
import Dexie, { type Table } from 'dexie';
import type { Tables } from '@/integrations/supabase/types';

export type SyncState =
  | 'local_only'         // never attempted backup (backup OFF, or queued before activation)
  | 'queued'             // backup ON, awaiting upload
  | 'backed_up'          // upload confirmed by backend
  | 'backup_failed';     // last upload attempt failed; record still safe locally

// Local rows mirror the Supabase row shapes but add sync metadata.
// owner_user_id scopes records to the signed-in account on this device.
export type LocalIncident = Tables<'incidents'> & {
  owner_user_id: string;
  sync_state: SyncState;
  last_sync_attempt_at: string | null;
  last_sync_error: string | null;
  local_updated_at: string; // bumped on any local write so sync can detect dirtiness
};

export type LocalFollowUpNote = Tables<'follow_up_notes'> & {
  owner_user_id: string;
  sync_state: SyncState;
  last_sync_attempt_at: string | null;
  last_sync_error: string | null;
  local_updated_at: string;
};

// Per-device key/value metadata (e.g. hydration completion per account).
export interface LocalMeta {
  key: string;
  value: string;
}

class ChronicleDB extends Dexie {
  incidents!: Table<LocalIncident, string>;
  follow_up_notes!: Table<LocalFollowUpNote, string>;
  meta!: Table<LocalMeta, string>;

  constructor() {
    super('chronicle_local');
    this.version(1).stores({
      incidents: 'id, owner_user_id, sync_state, incident_date, updated_at',
      follow_up_notes: 'id, owner_user_id, incident_id, sync_state, created_at',
      meta: 'key',
    });
    // v2 — adds record_date for daily records (separate canonical event date).
    // The schema string only needs to change if we want to index it. We don't
    // strictly need to, but bumping the version triggers any future reindex.
    this.version(2).stores({
      incidents: 'id, owner_user_id, sync_state, incident_date, record_date, updated_at',
    });
  }
}

export const localDB = new ChronicleDB();

// ---------- Meta helpers ----------
export const META_KEYS = {
  backupEnabled: 'backup_enabled',
  hydratedFor: (userId: string) => `hydrated_for:${userId}`,
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
