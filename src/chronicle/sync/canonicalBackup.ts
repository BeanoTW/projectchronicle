import { supabase } from '@/integrations/supabase/client';
import { localDB } from '@/local/db';
import { computeSha256 } from '@/lib/attachments/integrity';
import { V2MediaSchema } from '../model/contracts';
import type { SyncMetadata, V2Clarification, V2Media } from '../model/schema';
import { pushCanonicalOwner } from './canonicalCloud';

export const CANONICAL_MEDIA_BUCKET = 'canonical-media';
export const canonicalMediaPath = (ownerId: string, recordId: string, mediaId: string): string => `${ownerId}/${recordId}/${mediaId}`;

export class CanonicalCloudConflictError extends Error {}
export class CanonicalMediaIntegrityError extends Error {}

type ChildKind = 'clarification' | 'media' | 'history' | 'person' | 'relationship' | 'organisation';
type ChildRpcResult = { status: string; remote_revision?: number | null; payload?: unknown };

const syncedMeta = (sync: SyncMetadata, at: string, remoteVersion: number): SyncMetadata => ({
  remote_version: remoteVersion,
  local_revision: sync.local_revision,
  state: { state: 'synced', at, remote_version: remoteVersion },
  last_attempt_at: at,
});
const failedMeta = (sync: SyncMetadata, at: string, message: string): SyncMetadata => ({
  ...sync,
  state: { state: 'failed', at, attempts: sync.state.state === 'failed' ? sync.state.attempts + 1 : 1, message },
  last_attempt_at: at,
});
const conflictMeta = (sync: SyncMetadata, at: string, remoteVersion: number): SyncMetadata => ({
  ...sync,
  state: { state: 'conflict', detected_at: at, remote_version: remoteVersion },
  last_attempt_at: at,
});

const stripSync = <T extends { sync: SyncMetadata }>(value: T): Omit<T, 'sync'> => {
  const { sync: _sync, ...payload } = value;
  return payload;
};

async function putChild(options: {
  kind: ChildKind;
  id: string;
  recordId: string | null;
  payload: unknown;
  expectedRemoteRevision: number | null;
}): Promise<number> {
  const { data, error } = await supabase.rpc('sync_upsert_canonical_child' as never, {
    row_kind: options.kind,
    row_id: options.id,
    row_record_id: options.recordId,
    row_payload: options.payload,
    expected_remote_revision: options.expectedRemoteRevision,
  } as never);
  if (error) throw error;
  const result = data as unknown as ChildRpcResult;
  if (result.status === 'conflict') throw new CanonicalCloudConflictError(`Canonical ${options.kind} ${options.id} conflicts with remote revision ${result.remote_revision ?? 'absent'}.`);
  if (result.status !== 'ok' || typeof result.remote_revision !== 'number') throw new Error(`Canonical ${options.kind} sync returned an invalid response.`);
  return result.remote_revision;
}

async function backupClarification(value: V2Clarification, clock: () => string): Promise<void> {
  const at = clock();
  try {
    const revision = await putChild({ kind: 'clarification', id: value.id, recordId: value.record_id, payload: stripSync(value), expectedRemoteRevision: value.sync.remote_version });
    await localDB.canonical_clarifications.put({ ...value, sync: syncedMeta(value.sync, at, revision) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clarification backup failed.';
    if (error instanceof CanonicalCloudConflictError) {
      const match = message.match(/remote revision (\d+)/);
      await localDB.canonical_clarifications.put({ ...value, sync: match ? conflictMeta(value.sync, at, Number(match[1])) : failedMeta(value.sync, at, message) });
    } else await localDB.canonical_clarifications.put({ ...value, sync: failedMeta(value.sync, at, message) });
    throw error;
  }
}

async function ensureRemoteMediaBytes(media: V2Media): Promise<string> {
  const localBlob = await localDB.canonical_blobs.get(media.id);
  if (!localBlob || localBlob.owner_id !== media.owner_id || localBlob.record_id !== media.record_id) throw new CanonicalMediaIntegrityError(`Local bytes are missing for media ${media.id}.`);
  if (!media.content_hash) throw new CanonicalMediaIntegrityError(`Integrity hash is not recorded for media ${media.id}.`);
  const blob = new Blob([localBlob.bytes], { type: localBlob.mime || media.mime });
  const localHash = await computeSha256(blob);
  if (localHash.toLowerCase() !== media.content_hash.toLowerCase()) throw new CanonicalMediaIntegrityError(`Local bytes no longer match the recorded hash for media ${media.id}.`);

  const path = canonicalMediaPath(media.owner_id, media.record_id, media.id);
  const bucket = supabase.storage.from(CANONICAL_MEDIA_BUCKET);
  const uploaded = await bucket.upload(path, blob, { contentType: media.mime, upsert: false });
  if (!uploaded.error) return path;

  // A previous attempt may have committed the immutable object before the app
  // recorded success locally. Accept an existing object only if it hashes to
  // the exact sealed content; never overwrite it.
  const existing = await bucket.download(path);
  if (existing.error || !existing.data) throw uploaded.error;
  const remoteHash = await computeSha256(existing.data);
  if (remoteHash.toLowerCase() !== media.content_hash.toLowerCase()) throw new CanonicalMediaIntegrityError(`Remote media ${media.id} exists with different bytes.`);
  return path;
}

async function backupMedia(value: V2Media, clock: () => string): Promise<void> {
  const attemptAt = clock();
  try {
    const remotePath = await ensureRemoteMediaBytes(value);
    // Keep the remote identity payload deterministic across retries. A volatile
    // upload timestamp here would turn "server committed, client crashed"
    // into a false conflict on the next attempt. Restore uses the canonical
    // child row's server updated_at as the upload timestamp instead.
    const remotePayload = {
      ...stripSync(value),
      storage: { location: 'remote_only' as const, remote_path: remotePath },
    };
    const revision = await putChild({ kind: 'media', id: value.id, recordId: value.record_id, payload: remotePayload, expectedRemoteRevision: value.sync.remote_version });
    const uploadedAt = clock();
    await localDB.canonical_media.put(V2MediaSchema.parse({
      ...value,
      storage: { location: 'local_and_remote', remote_path: remotePath, uploaded_at: uploadedAt },
      sync: syncedMeta(value.sync, uploadedAt, revision),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Media backup failed.';
    await localDB.canonical_media.put(V2MediaSchema.parse({ ...value, sync: failedMeta(value.sync, attemptAt, message) }));
    throw error;
  }
}

async function backupAppendOnlyOwnerRows(ownerId: string): Promise<void> {
  const [history, people, organisations, relationships] = await Promise.all([
    localDB.canonical_history.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_people.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_organisations.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_relationships.where('owner_id').equals(ownerId).toArray(),
  ]);
  for (const value of people) await putChild({ kind: 'person', id: value.id, recordId: null, payload: value, expectedRemoteRevision: null });
  for (const value of organisations) await putChild({ kind: 'organisation', id: value.id, recordId: null, payload: value, expectedRemoteRevision: null });
  for (const value of history) await putChild({ kind: 'history', id: value.id, recordId: value.record_id, payload: value, expectedRemoteRevision: null });
  for (const value of relationships) await putChild({ kind: 'relationship', id: value.id, recordId: value.record_id, payload: value, expectedRemoteRevision: null });
}

export interface CanonicalBackupReport { records: number; clarifications: number; media: number; appendOnlyRows: number; }

export async function backupCanonicalOwner(ownerId: string, clock: () => string = () => new Date().toISOString()): Promise<CanonicalBackupReport> {
  if (!ownerId) throw new Error('Owner id is required for canonical backup.');
  const recordResults = await pushCanonicalOwner(ownerId);
  const recordConflict = recordResults.find(result => result.status === 'conflict');
  if (recordConflict) throw new CanonicalCloudConflictError(`Canonical record backup stopped at remote revision ${recordConflict.remoteRevision ?? 'absent'}.`);

  await backupAppendOnlyOwnerRows(ownerId);
  const clarifications = await localDB.canonical_clarifications.where('owner_id').equals(ownerId).toArray();
  for (const value of clarifications) if (value.sync.state.state !== 'synced') await backupClarification(value, clock);
  const media = await localDB.canonical_media.where('owner_id').equals(ownerId).toArray();
  for (const value of media) if (value.sync.state.state !== 'synced' || value.storage.location === 'local') await backupMedia(value, clock);

  const appendOnlyRows = await Promise.all([
    localDB.canonical_history.where('owner_id').equals(ownerId).count(),
    localDB.canonical_people.where('owner_id').equals(ownerId).count(),
    localDB.canonical_organisations.where('owner_id').equals(ownerId).count(),
    localDB.canonical_relationships.where('owner_id').equals(ownerId).count(),
  ]);
  return { records: recordResults.length, clarifications: clarifications.length, media: media.length, appendOnlyRows: appendOnlyRows.reduce((a, b) => a + b, 0) };
}
