import { supabase } from '@/integrations/supabase/client';
import { computeSha256 } from '@/lib/attachments/integrity';
import { ChronicleDB, localDB, type LocalCanonicalBlob } from '@/local/db';
import type { CanonicalMigrationBuild } from './canonicalMigration';
import type { V2Media } from './schema';

export class CanonicalMigrationMediaError extends Error {
  constructor(
    public readonly mediaId: string,
    public readonly code: 'missing_hash' | 'missing_path' | 'download_failed' | 'size_mismatch' | 'hash_mismatch' | 'local_conflict',
    message: string,
  ) {
    super(message);
  }
}

export type LegacyEvidenceDownloader = (path: string) => Promise<Blob>;

export const downloadLegacyEvidence: LegacyEvidenceDownloader = async path => {
  const { data, error } = await supabase.storage.from('evidence').download(path);
  if (error || !data) throw error ?? new Error('Legacy evidence could not be downloaded.');
  return data;
};

const sha256Recorded = (media: V2Media): string => {
  const value = media.content_hash?.trim().toLowerCase() ?? '';
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new CanonicalMigrationMediaError(media.id, 'missing_hash', `Evidence ${media.id} has no usable SHA-256 and cannot be verified for canonical activation.`);
  }
  return value;
};

const legacyPath = (media: V2Media): string => {
  if (media.storage.location !== 'remote_only' || !media.storage.remote_path) {
    throw new CanonicalMigrationMediaError(media.id, 'missing_path', `Evidence ${media.id} has no legacy storage path to import.`);
  }
  return media.storage.remote_path;
};

const blobFor = async (media: V2Media, blob: Blob, storedAt: string): Promise<LocalCanonicalBlob> => {
  const expectedHash = sha256Recorded(media);
  if (blob.size !== media.size) {
    throw new CanonicalMigrationMediaError(media.id, 'size_mismatch', `Evidence ${media.id} byte size does not match its recorded metadata.`);
  }
  const actualHash = (await computeSha256(blob)).toLowerCase();
  if (actualHash !== expectedHash) {
    throw new CanonicalMigrationMediaError(media.id, 'hash_mismatch', `Evidence ${media.id} does not match its recorded SHA-256.`);
  }
  return {
    id: media.id,
    owner_id: media.owner_id,
    record_id: media.record_id,
    bytes: await blob.arrayBuffer(),
    mime: media.mime,
    size: media.size,
    stored_at: storedAt,
  };
};

const assertExistingBlob = async (media: V2Media, existing: LocalCanonicalBlob): Promise<void> => {
  if (
    existing.owner_id !== media.owner_id
    || existing.record_id !== media.record_id
    || existing.size !== media.size
    || existing.mime !== media.mime
  ) {
    throw new CanonicalMigrationMediaError(media.id, 'local_conflict', `Existing local bytes for evidence ${media.id} have inconsistent identity or metadata.`);
  }
  await blobFor(media, new Blob([existing.bytes], { type: existing.mime }), existing.stored_at);
};

export interface CanonicalMigrationMediaImportReport {
  inspected: number;
  imported: number;
  already_verified: number;
}

/**
 * Imports legacy evidence bytes into Chronicle's canonical local byte store.
 * Downloads are verified against the legacy row's recorded SHA-256 and size
 * before any bytes are accepted. Successful earlier imports remain safe if a
 * later item fails, so the operation is resumable and idempotent.
 */
export const hydrateCanonicalMigrationMedia = async (
  build: CanonicalMigrationBuild,
  ownerId: string,
  db: ChronicleDB = localDB,
  download: LegacyEvidenceDownloader = downloadLegacyEvidence,
  clock: () => string = () => new Date().toISOString(),
): Promise<CanonicalMigrationMediaImportReport> => {
  const media = build.media.filter(item => item.owner_id === ownerId);
  let imported = 0;
  let alreadyVerified = 0;

  for (const item of media) {
    const existing = await db.canonical_blobs.get(item.id);
    if (existing) {
      await assertExistingBlob(item, existing);
      alreadyVerified += 1;
      continue;
    }

    const path = legacyPath(item);
    let downloaded: Blob;
    try {
      downloaded = await download(path);
    } catch (error) {
      throw new CanonicalMigrationMediaError(
        item.id,
        'download_failed',
        `Evidence ${item.id} could not be downloaded from its legacy storage location: ${error instanceof Error ? error.message : 'download failed'}`,
      );
    }
    const verified = await blobFor(item, downloaded, clock());
    await db.canonical_blobs.add(verified);
    imported += 1;
  }

  return { inspected: media.length, imported, already_verified: alreadyVerified };
};

/**
 * Activation-side proof that every migrated evidence row is recoverable from
 * locally verified bytes. This is deliberately independent of cloud backup:
 * switching read authority must not make legacy evidence inaccessible.
 */
export const auditCanonicalMigrationMediaReadiness = async (
  build: CanonicalMigrationBuild,
  ownerId: string,
  db: ChronicleDB = localDB,
): Promise<string[]> => {
  const reasons: string[] = [];
  for (const media of build.media.filter(item => item.owner_id === ownerId)) {
    const existing = await db.canonical_blobs.get(media.id);
    if (!existing) {
      reasons.push(`media:${media.id}:verified local bytes are missing`);
      continue;
    }
    try {
      await assertExistingBlob(media, existing);
    } catch (error) {
      reasons.push(`media:${media.id}:${error instanceof Error ? error.message : 'local byte verification failed'}`);
    }
  }
  return reasons;
};
