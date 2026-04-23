// Backup/sync engine.
//
// Trigger rule (deterministic, stated honestly to users in the diagnostics panel):
//   - Backup is attempted shortly after a local save when backup is ON and the
//     browser reports online.
//   - Failed backups retry only on: app load, manual "Retry now", regaining
//     connectivity, or the next local save. No hidden background polling.
import { supabase } from '@/integrations/supabase/client';
import { localDB, isBackupEnabled, setMeta, getMeta, META_KEYS, type LocalIncident, type LocalFollowUpNote } from './db';

export type SyncResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  lastError: string | null;
};

let inFlight: Promise<SyncResult> | null = null;
let lastResult: SyncResult | null = null;
let lastAttemptAt: string | null = null;

export const getLastSyncResult = () => lastResult;
export const getLastSyncAttemptAt = () => lastAttemptAt;

// Strip local-only fields before sending to Supabase.
const stripLocalIncident = (r: LocalIncident) => {
  const {
    owner_user_id, sync_state, last_sync_attempt_at, last_sync_error, local_updated_at,
    conflict_detected_at, cloud_last_modified_at, cloud_version,
    ...rest
  } = r;
  return rest;
};
const stripLocalNote = (r: LocalFollowUpNote) => {
  const { owner_user_id, sync_state, last_sync_attempt_at, last_sync_error, local_updated_at, ...rest } = r;
  return rest;
};

type SyncUpsertResponse =
  | { status: 'ok'; row: LocalIncident & { version: number; last_modified_at: string | null } }
  | { status: 'conflict'; server_version: number; server_last_modified_at: string | null; server_row: LocalIncident };

export const syncNow = async (userId: string): Promise<SyncResult> => {
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<SyncResult> => {
    const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, lastError: null };
    lastAttemptAt = new Date().toISOString();

    if (!(await isBackupEnabled())) return result;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      result.lastError = 'offline';
      return result;
    }

    // --- Incidents (conflict-aware via sync_upsert_incident RPC) ---
    const pendingIncidents = await localDB.incidents
      .where('owner_user_id').equals(userId)
      .filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed')
      .toArray();

    for (const row of pendingIncidents) {
      result.attempted += 1;
      try {
        const payload = stripLocalIncident(row);
        // Send the version we last observed from the server. New local-only
        // records never round-tripped through the server have version=1 and
        // _expected_version=null (handled below for inserts).
        const expected = (row.cloud_version ?? row.version ?? null) as number | null;
        const { data, error } = await supabase.rpc('sync_upsert_incident', {
          _row: payload as unknown as Record<string, unknown>,
          _expected_version: expected,
        });
        if (error) throw error;

        const resp = data as SyncUpsertResponse;
        if (resp?.status === 'conflict') {
          // Another device has moved this record on. Mark conflict and keep both copies.
          await localDB.incidents.update(row.id, {
            sync_state: 'conflict',
            last_sync_attempt_at: new Date().toISOString(),
            last_sync_error: 'Server has a newer version. Review before overwriting.',
            conflict_detected_at: new Date().toISOString(),
            cloud_last_modified_at: resp.server_last_modified_at,
            cloud_version: resp.server_version,
          });
          result.failed += 1;
          result.lastError = 'conflict';
          continue;
        }

        // OK — capture the server version so future edits stay conflict-safe.
        const serverVersion = resp?.row?.version ?? row.version ?? 1;
        await localDB.incidents.update(row.id, {
          sync_state: 'backed_up',
          last_sync_attempt_at: new Date().toISOString(),
          last_sync_error: null,
          version: serverVersion,
          cloud_version: serverVersion,
          conflict_detected_at: null,
          cloud_last_modified_at: null,
        });
        result.succeeded += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await localDB.incidents.update(row.id, {
          sync_state: 'backup_failed',
          last_sync_attempt_at: new Date().toISOString(),
          last_sync_error: msg,
        });
        result.failed += 1;
        result.lastError = msg;
      }
    }

    // --- Follow-up notes ---
    const pendingNotes = await localDB.follow_up_notes
      .where('owner_user_id').equals(userId)
      .filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed')
      .toArray();

    for (const row of pendingNotes) {
      result.attempted += 1;
      try {
        const payload = stripLocalNote(row);
        const { error } = await supabase.from('follow_up_notes').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        await localDB.follow_up_notes.update(row.id, {
          sync_state: 'backed_up',
          last_sync_attempt_at: new Date().toISOString(),
          last_sync_error: null,
        });
        result.succeeded += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await localDB.follow_up_notes.update(row.id, {
          sync_state: 'backup_failed',
          last_sync_attempt_at: new Date().toISOString(),
          last_sync_error: msg,
        });
        result.failed += 1;
        result.lastError = msg;
      }
    }

    lastResult = result;
    if (result.succeeded > 0) {
      await setMeta(META_KEYS.lastBackupAt(userId), new Date().toISOString());
    }
    return result;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

// Promote any local_only records to queued. Used when user turns backup ON
// (auto-queue all existing local records, per spec choice).
export const promoteAllLocalToQueued = async (userId: string): Promise<number> => {
  const incidents = await localDB.incidents
    .where('owner_user_id').equals(userId)
    .filter(r => r.sync_state === 'local_only')
    .toArray();
  for (const r of incidents) {
    await localDB.incidents.update(r.id, { sync_state: 'queued' });
  }
  const notes = await localDB.follow_up_notes
    .where('owner_user_id').equals(userId)
    .filter(r => r.sync_state === 'local_only')
    .toArray();
  for (const n of notes) {
    await localDB.follow_up_notes.update(n.id, { sync_state: 'queued' });
  }
  return incidents.length + notes.length;
};

// Demote queued (not-yet-uploaded) records back to local_only when backup is OFF.
// Backed-up records stay marked backed_up to reflect the truthful remote state.
export const demoteQueuedToLocalOnly = async (userId: string): Promise<number> => {
  const incidents = await localDB.incidents
    .where('owner_user_id').equals(userId)
    .filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed')
    .toArray();
  for (const r of incidents) {
    await localDB.incidents.update(r.id, { sync_state: 'local_only' });
  }
  const notes = await localDB.follow_up_notes
    .where('owner_user_id').equals(userId)
    .filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed')
    .toArray();
  for (const n of notes) {
    await localDB.follow_up_notes.update(n.id, { sync_state: 'local_only' });
  }
  return incidents.length + notes.length;
};

// User-initiated remote wipe (PART 9 / "Delete cloud copy"). Local data is untouched.
// Returns count of cloud rows deleted (best-effort, scoped by RLS to current user).
export const deleteCloudCopy = async (userId: string): Promise<{ incidents: number; notes: number }> => {
  const { error: nErr, count: nCount } = await supabase
    .from('follow_up_notes').delete({ count: 'exact' }).eq('user_id', userId);
  if (nErr) throw nErr;
  const { error: iErr, count: iCount } = await supabase
    .from('incidents').delete({ count: 'exact' }).eq('user_id', userId);
  if (iErr) throw iErr;

  // Mark all local rows as local_only since their cloud copy is gone.
  const incidents = await localDB.incidents.where('owner_user_id').equals(userId).toArray();
  for (const r of incidents) {
    await localDB.incidents.update(r.id, { sync_state: 'local_only', last_sync_error: null });
  }
  const notes = await localDB.follow_up_notes.where('owner_user_id').equals(userId).toArray();
  for (const n of notes) {
    await localDB.follow_up_notes.update(n.id, { sync_state: 'local_only', last_sync_error: null });
  }
  return { incidents: iCount ?? 0, notes: nCount ?? 0 };
};

// Read cloud counts (best-effort, scoped by RLS to current user).
// Returns null fields on network failure so the UI can show "unavailable".
export const getCloudCounts = async (): Promise<{ incidents: number | null; notes: number | null }> => {
  try {
    const inc = await supabase.from('incidents').select('*', { count: 'exact', head: true });
    const notes = await supabase.from('follow_up_notes').select('*', { count: 'exact', head: true });
    return {
      incidents: inc.error ? null : (inc.count ?? 0),
      notes: notes.error ? null : (notes.count ?? 0),
    };
  } catch {
    return { incidents: null, notes: null };
  }
};

// Read the most recent cloud incident updated_at (best-effort). Returns null
// if no rows or on network failure. Used purely for visibility (no sync side effects).
export const getCloudLastUpdatedAt = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0].updated_at ?? null;
  } catch {
    return null;
  }
};

// Restore from cloud → fully replaces local dataset for this user.
// User-initiated and confirmed in UI. Local-only (never-uploaded) records ARE wiped.
export const restoreFromCloud = async (userId: string): Promise<{ incidents: number; notes: number }> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('You appear to be offline. Connect to the internet and try again.');
  }
  const incRes = await supabase.from('incidents').select('*');
  if (incRes.error) throw incRes.error;
  const notesRes = await supabase.from('follow_up_notes').select('*');
  if (notesRes.error) throw notesRes.error;

  const nowIso = new Date().toISOString();

  await localDB.transaction('rw', localDB.incidents, localDB.follow_up_notes, async () => {
    const localInc = await localDB.incidents.where('owner_user_id').equals(userId).primaryKeys();
    await localDB.incidents.bulkDelete(localInc);
    const localNotes = await localDB.follow_up_notes.where('owner_user_id').equals(userId).primaryKeys();
    await localDB.follow_up_notes.bulkDelete(localNotes);

    const incidents: LocalIncident[] = (incRes.data ?? []).map(r => ({
      ...r,
      owner_user_id: userId,
      sync_state: 'backed_up',
      last_sync_attempt_at: nowIso,
      last_sync_error: null,
      local_updated_at: nowIso,
    }));
    const notes: LocalFollowUpNote[] = (notesRes.data ?? []).map(r => ({
      ...r,
      owner_user_id: userId,
      sync_state: 'backed_up',
      last_sync_attempt_at: nowIso,
      last_sync_error: null,
      local_updated_at: nowIso,
    }));
    await localDB.incidents.bulkPut(incidents);
    await localDB.follow_up_notes.bulkPut(notes);
  });

  await setMeta(META_KEYS.lastRestoreAt(userId), nowIso);
  return { incidents: incRes.data?.length ?? 0, notes: notesRes.data?.length ?? 0 };
};

export const getLastBackupAt = async (userId: string): Promise<string | null> => {
  return await getMeta(META_KEYS.lastBackupAt(userId));
};
export const getLastRestoreAt = async (userId: string): Promise<string | null> => {
  return await getMeta(META_KEYS.lastRestoreAt(userId));
};
