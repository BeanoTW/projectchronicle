import { supabase } from '@/integrations/supabase/client';
import { localDB } from '@/local/db';
import { V2RecordSchema } from '../model/contracts';
import type { V2Record } from '../model/schema';

export type CanonicalPushResult =
  | { status: 'ok'; remoteRevision: number; record: V2Record }
  | { status: 'conflict'; remoteRevision: number | null; remoteRecord: V2Record | null };

const attempted = (record: V2Record, at: string): V2Record => V2RecordSchema.parse({
  ...record,
  sync: { ...record.sync, state: { state: 'syncing' }, last_attempt_at: at },
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
  await localDB.canonical_records.put(attempted(record, at));

  const { data, error } = await supabase.rpc('sync_upsert_canonical_record' as never, {
    row_id: record.id,
    row_payload: record,
    row_local_revision: record.sync.local_revision,
    expected_remote_revision: record.sync.remote_version,
  } as never);

  if (error) {
    await localDB.canonical_records.put(V2RecordSchema.parse({
      ...record,
      sync: { ...record.sync, state: { state: 'error', message: error.message }, last_attempt_at: at },
    }));
    throw error;
  }

  const result = data as unknown as { status: string; remote_revision?: number | null; payload?: unknown };
  if (result.status === 'conflict') {
    const remoteRecord = result.payload ? V2RecordSchema.parse(result.payload) : null;
    await localDB.canonical_records.put(V2RecordSchema.parse({
      ...record,
      sync: {
        ...record.sync,
        state: { state: 'conflict' },
        last_attempt_at: at,
      },
    }));
    return { status: 'conflict', remoteRevision: result.remote_revision ?? null, remoteRecord };
  }

  if (result.status !== 'ok' || typeof result.remote_revision !== 'number') {
    throw new Error('Canonical sync returned an invalid response.');
  }

  const synced = V2RecordSchema.parse({
    ...record,
    sync: {
      remote_version: result.remote_revision,
      local_revision: record.sync.local_revision,
      state: { state: 'synced' },
      last_attempt_at: at,
    },
  });
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
