import { supabase } from '@/integrations/supabase/client';
import { localDB, META_KEYS, setMeta, type LocalCanonicalBlob } from '@/local/db';
import { computeSha256 } from '@/lib/attachments/integrity';
import { V2MediaSchema, V2RecordSchema } from '../model/contracts';
import type { SyncMetadata, V2Clarification, V2Record } from '../model/schema';
import {
  CANONICAL_MEDIA_BUCKET,
  CanonicalCloudConflictError,
  CanonicalMediaIntegrityError,
  type RemoteMediaPayload,
} from './canonicalBackup';

type RemoteRecordRow = { payload: unknown };
type RemoteChildRow = {
  kind: 'clarification' | 'media' | 'history' | 'person' | 'relationship' | 'organisation';
  id: string;
  record_id: string | null;
  payload: unknown;
  remote_revision: number;
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const withoutRecordSync = (value: V2Record): Omit<V2Record, 'sync'> => {
  const { sync: _sync, ...rest } = value;
  return rest;
};
const restoredSync = (remoteVersion: number, at: string): SyncMetadata => ({
  remote_version: remoteVersion,
  local_revision: 0,
  state: { state: 'synced', at, remote_version: remoteVersion },
  last_attempt_at: at,
});

async function fetchRemoteRows(ownerId: string): Promise<{ records: V2Record[]; children: RemoteChildRow[] }> {
  const recordQuery = await supabase.from('canonical_records' as never).select('payload').eq('owner_id' as never, ownerId as never);
  if (recordQuery.error) throw recordQuery.error;
  const childQuery = await supabase.from('canonical_children' as never).select('kind,id,record_id,payload,remote_revision').eq('owner_id' as never, ownerId as never);
  if (childQuery.error) throw childQuery.error;

  const records = ((recordQuery.data ?? []) as unknown as RemoteRecordRow[]).map(row => V2RecordSchema.parse(row.payload));
  for (const record of records) {
    if (record.owner_id !== ownerId) throw new CanonicalCloudConflictError('Remote canonical record belongs to another owner.');
  }
  const children = (childQuery.data ?? []) as unknown as RemoteChildRow[];
  for (const child of children) {
    if (!Number.isInteger(child.remote_revision) || child.remote_revision < 1) throw new CanonicalCloudConflictError(`Remote canonical child ${child.id} has an invalid revision.`);
  }
  return { records, children };
}

function assertChildOwner(payload: unknown, ownerId: string, id: string): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== 'object') throw new CanonicalCloudConflictError(`Remote canonical child ${id} has no payload.`);
  const row = payload as Record<string, unknown>;
  if (row.owner_id !== ownerId || row.id !== id) throw new CanonicalCloudConflictError(`Remote canonical child ${id} has inconsistent identity.`);
}

async function materialiseRemoteMedia(ownerId: string, child: RemoteChildRow, at: string): Promise<{ media: ReturnType<typeof V2MediaSchema.parse>; blob: LocalCanonicalBlob }> {
  assertChildOwner(child.payload, ownerId, child.id);
  const raw = child.payload as unknown as RemoteMediaPayload;
  if (raw.storage?.location !== 'remote_only' || !raw.storage.remote_path) throw new CanonicalMediaIntegrityError(`Remote media ${child.id} has no canonical object path.`);
  if (!raw.content_hash) throw new CanonicalMediaIntegrityError(`Remote media ${child.id} has no recorded integrity hash.`);
  if (!raw._remote_uploaded_at) throw new CanonicalMediaIntegrityError(`Remote media ${child.id} has no recorded upload timestamp.`);

  const downloaded = await supabase.storage.from(CANONICAL_MEDIA_BUCKET).download(raw.storage.remote_path);
  if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error(`Remote media ${child.id} could not be downloaded.`);
  const hash = await computeSha256(downloaded.data);
  if (hash.toLowerCase() !== raw.content_hash.toLowerCase()) throw new CanonicalMediaIntegrityError(`Downloaded media ${child.id} does not match its recorded SHA-256.`);
  if (downloaded.data.size !== raw.size) throw new CanonicalMediaIntegrityError(`Downloaded media ${child.id} does not match its recorded size.`);

  const { _remote_uploaded_at, ...canonical } = raw;
  const media = V2MediaSchema.parse({
    ...canonical,
    storage: { location: 'local_and_remote', remote_path: raw.storage.remote_path, uploaded_at: _remote_uploaded_at },
    sync: restoredSync(child.remote_revision, at),
  });
  const blob: LocalCanonicalBlob = {
    id: media.id,
    owner_id: media.owner_id,
    record_id: media.record_id,
    bytes: await downloaded.data.arrayBuffer(),
    mime: media.mime,
    size: media.size,
    stored_at: at,
  };
  return { media, blob };
}

export interface CanonicalRestoreReport {
  recordsAdded: number;
  recordsAlreadyLocal: number;
  childrenAdded: number;
  childrenAlreadyLocal: number;
  mediaDownloaded: number;
}

/**
 * Non-destructive new-device hydration. Remote rows may fill local gaps but
 * never replace a divergent local canonical row. Any divergence stops restore
 * and leaves the local copy authoritative for later conflict resolution.
 */
export async function restoreCanonicalOwner(ownerId: string, clock: () => string = () => new Date().toISOString()): Promise<CanonicalRestoreReport> {
  if (!ownerId) throw new Error('Owner id is required for canonical restore.');
  const at = clock();
  const { records, children } = await fetchRemoteRows(ownerId);
  const remoteRecordIds = new Set(records.map(record => record.id));
  for (const child of children) {
    assertChildOwner(child.payload, ownerId, child.id);
    if (child.record_id && !remoteRecordIds.has(child.record_id)) throw new CanonicalCloudConflictError(`Remote child ${child.id} points to a missing canonical record.`);
  }

  let recordsAdded = 0;
  let recordsAlreadyLocal = 0;
  for (const remote of records) {
    const local = await localDB.canonical_records.get(remote.id);
    if (!local) continue;
    const parsed = V2RecordSchema.parse(local);
    if (parsed.owner_id !== ownerId || !same(withoutRecordSync(parsed), withoutRecordSync(remote))) {
      throw new CanonicalCloudConflictError(`Local canonical record ${remote.id} differs from its remote copy; restore will not overwrite it.`);
    }
    recordsAlreadyLocal++;
  }

  const preparedMedia = new Map<string, Awaited<ReturnType<typeof materialiseRemoteMedia>>>();
  for (const child of children.filter(value => value.kind === 'media')) {
    const existingMedia = await localDB.canonical_media.get(child.id);
    const existingBlob = await localDB.canonical_blobs.get(child.id);
    if (existingMedia && existingBlob) {
      const blob = new Blob([existingBlob.bytes], { type: existingBlob.mime });
      if (!existingMedia.content_hash || (await computeSha256(blob)).toLowerCase() !== existingMedia.content_hash.toLowerCase()) {
        throw new CanonicalMediaIntegrityError(`Existing local media ${child.id} fails its recorded integrity hash.`);
      }
      continue;
    }
    preparedMedia.set(child.id, await materialiseRemoteMedia(ownerId, child, at));
  }

  let childrenAdded = 0;
  let childrenAlreadyLocal = 0;
  await localDB.transaction('rw', [
    localDB.canonical_records, localDB.canonical_clarifications, localDB.canonical_media, localDB.canonical_blobs,
    localDB.canonical_history, localDB.canonical_people, localDB.canonical_organisations, localDB.canonical_relationships,
  ], async () => {
    for (const remote of records) {
      if (await localDB.canonical_records.get(remote.id)) continue;
      await localDB.canonical_records.add(remote);
      recordsAdded++;
    }

    for (const child of children) {
      const payload = child.payload as Record<string, unknown>;
      if (child.kind === 'media') {
        const prepared = preparedMedia.get(child.id);
        if (!prepared) { childrenAlreadyLocal++; continue; }
        await localDB.canonical_media.add(prepared.media);
        await localDB.canonical_blobs.add(prepared.blob);
        childrenAdded++;
        continue;
      }
      if (child.kind === 'clarification') {
        const existing = await localDB.canonical_clarifications.get(child.id);
        const restored = { ...(payload as unknown as Omit<V2Clarification, 'sync'>), sync: restoredSync(child.remote_revision, at) } as V2Clarification;
        if (existing) {
          const { sync: _a, ...existingBody } = existing; const { sync: _b, ...remoteBody } = restored;
          if (!same(existingBody, remoteBody)) throw new CanonicalCloudConflictError(`Local clarification ${child.id} differs from remote.`);
          childrenAlreadyLocal++; continue;
        }
        await localDB.canonical_clarifications.add(restored); childrenAdded++; continue;
      }

      const table = child.kind === 'history' ? localDB.canonical_history
        : child.kind === 'person' ? localDB.canonical_people
          : child.kind === 'organisation' ? localDB.canonical_organisations
            : localDB.canonical_relationships;
      const existing = await table.get(child.id as never) as unknown;
      if (existing) {
        if (!same(existing, payload)) throw new CanonicalCloudConflictError(`Local ${child.kind} ${child.id} differs from remote.`);
        childrenAlreadyLocal++; continue;
      }
      await (table as unknown as { add(value: unknown): Promise<unknown> }).add(payload);
      childrenAdded++;
    }
  });

  await setMeta(META_KEYS.lastRestoreAt(ownerId), at);
  return { recordsAdded, recordsAlreadyLocal, childrenAdded, childrenAlreadyLocal, mediaDownloaded: preparedMedia.size };
}
