import { supabase } from '@/integrations/supabase/client';
import { localDB } from '@/local/db';
import { V2RecordSchema } from '../model/contracts';
import type { V2Record } from '../model/schema';

export type CanonicalPushResult =
  | { status: 'ok'; remoteRevision: number; record: V2Record }
  | { status: 'conflict'; remoteRevision: number | null; remoteRecord: V2Record | null };

export const markCanonicalQueued = (record: V2Record, at: string): V2Record => V2RecordSchema.parse({
  ...record,
  sync: { ...record.sync, state: { state: 'queued', since: at }, last_attempt_at: at },
});

export const markCanonicalFailed = (record: V2Record, at: string, message: string): V2Record => {
  const attempts = record.sync.state.state === 'failed' ? record.sync.state.attempts + 1 : 1;
  return V2RecordSchema.parse({
    ...record,
    sync: { ...record.sync, state: { state: 'failed', at, attempts, message }, last_attempt_at: at },
  });
};

export const markCanonicalConflict = (record: V2Record, at: string, remoteVersion: number): V2Record => V2RecordSchema.parse({
  ...record,
  sync: { ...record.sync, state: { state: 'conflict', detected_at: at, remote_version: remoteVersion }, last_attempt_at: at },
});

export const markCanonicalSynced = (record: V2Record, at: string, remoteVersion: number): V2Record => V2RecordSchema.parse({
  ...record,
  sync: {
    remote_version: remoteVersion,
    local_revision: record.sync.local_revision,
    state: { state: 'synced', at, remote_version: remoteVersion },
    last_attempt_at: at,
  },
});

/**
 * Push exactly one canonical record using the server's compare-and-swap RPC.
 * Conflict is a first-class state: this function never silently chooses local
 * or remote content and never overwrites a changed remote record.
 */
export async function pushCanonicalRecord(
  ownerId: string,
  recordId: string,
  clock: () => string = () => new Date().toISOString(),
): Promise<CanonicalPushResult> {
  const raw = await localDB.canonical_records.get(recordId);
  if (!raw || raw.owner_id !== ownerId) throw new Error('Canonical record was not found for this owner.');
  const record = V2RecordSchema.parse(raw);
  const at = clock();
  await localDB.canonical_records.put(markCanonicalQueued(record, at));

  const { data, error } = await supabase.rpc('sync_upsert_canonical_record' as never, {
    row_id: record.id,
    row_payload: record,
    row_local_revision: record.sync.local_revision,
    expected_remote_revision: record.sync.remote_version,
  } as never);

  if (error) {
    await localDB.canonical_records.put(markCanonicalFailed(record, at, error.message));
    throw error;
  }

  const result = data as unknown as { status: string; remote_revision?: number | null; payload?: unknown };
  if (result.status === 'conflict') {
    const remoteRecord = result.payload ? V2RecordSchema.parse(result.payload) : null;
    const remoteRevision = result.remote_revision ?? null;
    if (remoteRevision === null) {
      // The local contract deliberately has no fake numeric version for a missing
      // remote row. Preserve that fact as a failed sync and return the explicit
      // conflict to the caller rather than inventing version 0.
      await localDB.canonical_records.put(markCanonicalFailed(record, at, 'Remote canonical row was unexpectedly absent.'));
    } else {
      await localDB.canonical_records.put(markCanonicalConflict(record, at, remoteRevision));
    }
    return { status: 'conflict', remoteRevision, remoteRecord };
  }

  if (result.status !== 'ok' || typeof result.remote_revision !== 'number') {
    const message = 'Canonical sync returned an invalid response.';
    await localDB.canonical_records.put(markCanonicalFailed(record, at, message));
    throw new Error(message);
  }

  const synced = markCanonicalSynced(record, at, result.remote_revision);
  await localDB.canonical_records.put(synced);
  return { status: 'ok', remoteRevision: result.remote_revision, record: synced };
}

/** Push local canonical records that are not currently known to be clean. */
export async function pushCanonicalOwner(ownerId: string): Promise<CanonicalPushResult[]> {
  const records = await localDB.canonical_records.where('owner_id').equals(ownerId).toArray();
  const pending = records
    .map(value => V2RecordSchema.parse(value))
    .filter(record => record.sync.state.state !== 'synced');

  const results: CanonicalPushResult[] = [];
  for (const record of pending) results.push(await pushCanonicalRecord(ownerId, record.id));
  return results;
}
