import { supabase } from '@/integrations/supabase/client';
import { localDB, type LocalCanonicalBlob } from '@/local/db';
import { computeSha256 } from '@/lib/attachments/integrity';
import { V2MediaSchema, V2RecordSchema } from '../model/contracts';
import type { SyncMetadata, V2Clarification, V2Media, V2Record } from '../model/schema';
import { CANONICAL_MEDIA_BUCKET, CanonicalCloudConflictError, CanonicalMediaIntegrityError } from './canonicalBackup';
import {
  RemoteClarificationBodySchema,
  RemoteOrganisationSchema,
  RemotePersonSchema,
  RemoteRecordEventSchema,
  RemoteRelationshipSchema,
} from './canonicalRemoteContracts';

type RemoteRecordRow = { payload: unknown };
type RemoteChildRow = {
  kind: 'clarification' | 'media' | 'history' | 'person' | 'relationship' | 'organisation';
  id: string;
  record_id: string | null;
  payload: unknown;
  remote_revision: number;
  updated_at: string;
};
type RemoteMediaPayload = Omit<V2Media, 'sync' | 'storage'> & { storage: { location: 'remote_only'; remote_path: string } };
type PreparedMedia = { media: V2Media; blob: LocalCanonicalBlob | null; hadMedia: boolean; hadBlob: boolean };

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const withoutRecordSync = (value: V2Record): Omit<V2Record, 'sync'> => { const { sync: _sync, ...rest } = value; return rest; };
const withoutMediaTransport = (value: V2Media): Omit<V2Media, 'sync' | 'storage'> => { const { sync: _sync, storage: _storage, ...rest } = value; return rest; };
const restoredSync = (remoteVersion: number, at: string, localRevision = 0): SyncMetadata => ({
  remote_version: remoteVersion,
  local_revision: localRevision,
  state: { state: 'synced', at, remote_version: remoteVersion },
  last_attempt_at: at,
});

async function fetchRemoteRows(ownerId: string): Promise<{ records: V2Record[]; children: RemoteChildRow[] }> {
  const recordQuery = await supabase.from('canonical_records' as never).select('payload').eq('owner_id' as never, ownerId as never);
  if (recordQuery.error) throw recordQuery.error;
  const childQuery = await supabase.from('canonical_children' as never).select('kind,id,record_id,payload,remote_revision,updated_at').eq('owner_id' as never, ownerId as never);
  if (childQuery.error) throw childQuery.error;

  const records = ((recordQuery.data ?? []) as unknown as RemoteRecordRow[]).map(row => V2RecordSchema.parse(row.payload));
  for (const record of records) if (record.owner_id !== ownerId) throw new CanonicalCloudConflictError('Remote canonical record belongs to another owner.');
  const children = (childQuery.data ?? []) as unknown as RemoteChildRow[];
  for (const child of children) {
    if (!Number.isInteger(child.remote_revision) || child.remote_revision < 1) throw new CanonicalCloudConflictError(`Remote canonical child ${child.id} has an invalid revision.`);
    if (!child.updated_at || Number.isNaN(new Date(child.updated_at).getTime())) throw new CanonicalCloudConflictError(`Remote canonical child ${child.id} has an invalid server timestamp.`);
  }
  return { records, children };
}

function assertChildIdentity(child: RemoteChildRow, ownerId: string): asserts child is RemoteChildRow & { payload: Record<string, unknown> } {
  if (!child.payload || typeof child.payload !== 'object') throw new CanonicalCloudConflictError(`Remote canonical child ${child.id} has no payload.`);
  const row = child.payload as Record<string, unknown>;
  if (row.owner_id !== ownerId || row.id !== child.id) throw new CanonicalCloudConflictError(`Remote canonical child ${child.id} has inconsistent identity.`);
  const payloadRecordId = typeof row.record_id === 'string' ? row.record_id : null;
  if (payloadRecordId !== child.record_id) throw new CanonicalCloudConflictError(`Remote canonical child ${child.id} has inconsistent record membership.`);
  if ((child.kind === 'person' || child.kind === 'organisation') && child.record_id !== null) throw new CanonicalCloudConflictError(`Remote ${child.kind} ${child.id} must not be attached to a record row.`);
  if (child.kind !== 'person' && child.kind !== 'organisation' && child.record_id === null) throw new CanonicalCloudConflictError(`Remote ${child.kind} ${child.id} is missing its record id.`);
}

function validateRemoteChildPayload(child: RemoteChildRow): void {
  if (child.kind === 'media') return;
  if (child.kind === 'clarification') { RemoteClarificationBodySchema.parse(child.payload); return; }
  if (child.kind === 'history') { RemoteRecordEventSchema.parse(child.payload); return; }
  if (child.kind === 'person') { RemotePersonSchema.parse(child.payload); return; }
  if (child.kind === 'organisation') { RemoteOrganisationSchema.parse(child.payload); return; }
  RemoteRelationshipSchema.parse(child.payload);
}

function localMediaFromRemote(child: RemoteChildRow & { payload: Record<string, unknown> }, at: string): V2Media {
  const raw = child.payload as unknown as RemoteMediaPayload;
  if (raw.storage?.location !== 'remote_only' || !raw.storage.remote_path) throw new CanonicalMediaIntegrityError(`Remote media ${child.id} has no canonical object path.`);
  if (!raw.content_hash) throw new CanonicalMediaIntegrityError(`Remote media ${child.id} has no recorded integrity hash.`);
  const expectedPath = `${raw.owner_id}/${raw.record_id}/${raw.id}`;
  if (raw.storage.remote_path !== expectedPath) throw new CanonicalMediaIntegrityError(`Remote media ${child.id} has an inconsistent canonical object path.`);
  return V2MediaSchema.parse({
    ...raw,
    storage: { location: 'local_and_remote', remote_path: raw.storage.remote_path, uploaded_at: child.updated_at },
    sync: restoredSync(child.remote_revision, at),
  });
}

async function verifyLocalBlob(blob: LocalCanonicalBlob, media: V2Media): Promise<void> {
  if (blob.owner_id !== media.owner_id || blob.record_id !== media.record_id || blob.size !== media.size) throw new CanonicalMediaIntegrityError(`Existing local media ${media.id} has inconsistent byte metadata.`);
  if (!media.content_hash) throw new CanonicalMediaIntegrityError(`Existing local media ${media.id} has no integrity hash.`);
  const hash = await computeSha256(new Blob([blob.bytes], { type: blob.mime || media.mime }));
  if (hash.toLowerCase() !== media.content_hash.toLowerCase()) throw new CanonicalMediaIntegrityError(`Existing local media ${media.id} fails its recorded integrity hash.`);
}

async function downloadRemoteBlob(media: V2Media, at: string): Promise<LocalCanonicalBlob> {
  if (media.storage.location !== 'local_and_remote') throw new CanonicalMediaIntegrityError(`Remote media ${media.id} has no downloadable canonical path.`);
  const downloaded = await supabase.storage.from(CANONICAL_MEDIA_BUCKET).download(media.storage.remote_path);
  if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error(`Remote media ${media.id} could not be downloaded.`);
  if (!media.content_hash) throw new CanonicalMediaIntegrityError(`Remote media ${media.id} has no recorded integrity hash.`);
  const hash = await computeSha256(downloaded.data);
  if (hash.toLowerCase() !== media.content_hash.toLowerCase()) throw new CanonicalMediaIntegrityError(`Downloaded media ${media.id} does not match its recorded SHA-256.`);
  if (downloaded.data.size !== media.size) throw new CanonicalMediaIntegrityError(`Downloaded media ${media.id} does not match its recorded size.`);
  return { id: media.id, owner_id: media.owner_id, record_id: media.record_id, bytes: await downloaded.data.arrayBuffer(), mime: media.mime, size: media.size, stored_at: at };
}

async function prepareMedia(ownerId: string, child: RemoteChildRow, at: string): Promise<PreparedMedia> {
  assertChildIdentity(child, ownerId);
  const remoteMedia = localMediaFromRemote(child, at);
  const [existingMediaRaw, existingBlob] = await Promise.all([localDB.canonical_media.get(child.id), localDB.canonical_blobs.get(child.id)]);
  const existingMedia = existingMediaRaw ? V2MediaSchema.parse(existingMediaRaw) : null;
  if (existingMedia && (existingMedia.owner_id !== ownerId || !same(withoutMediaTransport(existingMedia), withoutMediaTransport(remoteMedia)))) {
    throw new CanonicalCloudConflictError(`Local media ${child.id} differs from its remote metadata; restore will not overwrite it.`);
  }
  if (existingBlob) await verifyLocalBlob(existingBlob, remoteMedia);
  const blob = existingBlob ?? await downloadRemoteBlob(remoteMedia, at);
  return { media: remoteMedia, blob: existingBlob ? null : blob, hadMedia: !!existingMedia, hadBlob: !!existingBlob };
}

export interface CanonicalRestoreReport { recordsAdded: number; recordsAlreadyLocal: number; childrenAdded: number; childrenAlreadyLocal: number; mediaDownloaded: number; }

export async function restoreCanonicalOwner(ownerId: string, clock: () => string = () => new Date().toISOString()): Promise<CanonicalRestoreReport> {
  if (!ownerId) throw new Error('Owner id is required for canonical restore.');
  const at = clock();
  const { records, children } = await fetchRemoteRows(ownerId);
  const remoteRecordIds = new Set(records.map(record => record.id));
  const remoteEntities = new Set(children.filter(child => child.kind === 'person' || child.kind === 'organisation').map(child => `${child.kind}:${child.id}`));

  for (const child of children) {
    assertChildIdentity(child, ownerId);
    validateRemoteChildPayload(child);
    if (child.record_id && !remoteRecordIds.has(child.record_id)) throw new CanonicalCloudConflictError(`Remote child ${child.id} points to a missing canonical record.`);
    if (child.kind === 'relationship') {
      const relationship = RemoteRelationshipSchema.parse(child.payload);
      if (!remoteEntities.has(`${relationship.entity_type}:${relationship.entity_id}`)) {
        throw new CanonicalCloudConflictError(`Remote relationship ${child.id} points to a missing ${relationship.entity_type}.`);
      }
    }
  }

  let recordsAdded = 0;
  let recordsAlreadyLocal = 0;
  for (const remote of records) {
    const local = await localDB.canonical_records.get(remote.id);
    if (!local) continue;
    const parsed = V2RecordSchema.parse(local);
    if (parsed.owner_id !== ownerId || !same(withoutRecordSync(parsed), withoutRecordSync(remote))) throw new CanonicalCloudConflictError(`Local canonical record ${remote.id} differs from its remote copy; restore will not overwrite it.`);
    recordsAlreadyLocal++;
  }

  const preparedMedia = new Map<string, PreparedMedia>();
  for (const child of children.filter(value => value.kind === 'media')) preparedMedia.set(child.id, await prepareMedia(ownerId, child, at));

  let childrenAdded = 0;
  let childrenAlreadyLocal = 0;
  await localDB.transaction('rw', [
    localDB.canonical_records, localDB.canonical_clarifications, localDB.canonical_media, localDB.canonical_blobs,
    localDB.canonical_history, localDB.canonical_people, localDB.canonical_organisations, localDB.canonical_relationships,
  ], async () => {
    for (const remote of records) {
      if (await localDB.canonical_records.get(remote.id)) continue;
      await localDB.canonical_records.add(remote); recordsAdded++;
    }

    for (const child of children) {
      const payload = child.payload as Record<string, unknown>;
      if (child.kind === 'media') {
        const prepared = preparedMedia.get(child.id)!;
        if (!prepared.hadMedia) childrenAdded++; else childrenAlreadyLocal++;
        await localDB.canonical_media.put(prepared.media);
        if (prepared.blob) await localDB.canonical_blobs.put(prepared.blob);
        continue;
      }
      if (child.kind === 'clarification') {
        const existing = await localDB.canonical_clarifications.get(child.id);
        const body = RemoteClarificationBodySchema.parse(payload);
        const restored: V2Clarification = { ...body, sync: restoredSync(child.remote_revision, at) };
        if (existing) {
          const { sync: _a, ...existingBody } = existing; const { sync: _b, ...remoteBody } = restored;
          if (!same(existingBody, remoteBody)) throw new CanonicalCloudConflictError(`Local clarification ${child.id} differs from remote.`);
          childrenAlreadyLocal++;
        } else { await localDB.canonical_clarifications.add(restored); childrenAdded++; }
        continue;
      }
      if (child.kind === 'history') {
        const remote = RemoteRecordEventSchema.parse(payload);
        const existing = await localDB.canonical_history.get(child.id);
        if (existing && !same(existing, remote)) throw new CanonicalCloudConflictError(`Local history ${child.id} differs from remote.`);
        if (existing) childrenAlreadyLocal++; else { await localDB.canonical_history.add(remote); childrenAdded++; }
        continue;
      }
      if (child.kind === 'person') {
        const remote = RemotePersonSchema.parse(payload);
        const existing = await localDB.canonical_people.get(child.id);
        if (existing && !same(existing, remote)) throw new CanonicalCloudConflictError(`Local person ${child.id} differs from remote.`);
        if (existing) childrenAlreadyLocal++; else { await localDB.canonical_people.add(remote); childrenAdded++; }
        continue;
      }
      if (child.kind === 'organisation') {
        const remote = RemoteOrganisationSchema.parse(payload);
        const existing = await localDB.canonical_organisations.get(child.id);
        if (existing && !same(existing, remote)) throw new CanonicalCloudConflictError(`Local organisation ${child.id} differs from remote.`);
        if (existing) childrenAlreadyLocal++; else { await localDB.canonical_organisations.add(remote); childrenAdded++; }
        continue;
      }
      const remote = RemoteRelationshipSchema.parse(payload);
      const existing = await localDB.canonical_relationships.get(child.id);
      if (existing && !same(existing, remote)) throw new CanonicalCloudConflictError(`Local relationship ${child.id} differs from remote.`);
      if (existing) childrenAlreadyLocal++; else { await localDB.canonical_relationships.add(remote); childrenAdded++; }
    }
  });

  return { recordsAdded, recordsAlreadyLocal, childrenAdded, childrenAlreadyLocal, mediaDownloaded: Array.from(preparedMedia.values()).filter(value => !value.hadBlob).length };
}
