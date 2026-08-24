// Phase 3 — canonical local persistence, still not wired to production UI.
//
// This repository is the only Phase 3 write surface for canonical records. It
// intentionally exposes no operation that can replace `record.original` after
// seal. Existing V1 tables remain untouched and authoritative until activation.
import {
  CanonicalRecordMutationSchema,
  V2MediaSchema,
  V2RecordSchema,
} from './contracts';
import type { CanonicalRecordReader, CanonicalRecordWriter, SealRecordInput } from './adapters';
import {
  V2_SCHEMA_VERSION,
  type DossierMembership,
  type OrganisationalDetails,
  type SyncMetadata,
  type V2Clarification,
  type V2Media,
  type V2Record,
  type V2RecordEvent,
} from './schema';
import { ChronicleDB, localDB } from '@/local/db';

export class CanonicalNotFoundError extends Error {}
export class CanonicalOwnershipError extends Error {}
export class CanonicalRevisionConflictError extends Error {}
export class CanonicalImmutableConflictError extends Error {}
export class CanonicalLifecycleError extends Error {}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const localOnlySync = (previous?: SyncMetadata): SyncMetadata => ({
  remote_version: previous?.remote_version ?? null,
  local_revision: (previous?.local_revision ?? 0) + 1,
  state: { state: 'local_only' },
  last_attempt_at: previous?.last_attempt_at ?? null,
});

const owned = (record: V2Record | undefined, ownerId: string, recordId: string): V2Record => {
  if (!record) throw new CanonicalNotFoundError(`Canonical record ${recordId} was not found.`);
  if (record.owner_id !== ownerId) throw new CanonicalOwnershipError('Canonical record belongs to another owner.');
  return record;
};

const active = (record: V2Record): V2Record => {
  if (record.lifecycle.state !== 'sealed') {
    throw new CanonicalLifecycleError(`Canonical record is ${record.lifecycle.state} and cannot be changed.`);
  }
  return record;
};

const ensureChildIdentity = (
  parent: V2Record,
  child: { owner_id: string; record_id: string },
): void => {
  if (child.owner_id !== parent.owner_id || child.record_id !== parent.id) {
    throw new CanonicalOwnershipError('Canonical child row does not match its owner and record.');
  }
};

export const createCanonicalLocalRepository = (
  db: ChronicleDB = localDB,
  clock: () => string = () => new Date().toISOString(),
): CanonicalRecordReader & CanonicalRecordWriter => ({
  async get(ownerId, recordId) {
    const record = await db.canonical_records.get(recordId);
    if (!record || record.owner_id !== ownerId) return null;
    return V2RecordSchema.parse(record);
  },

  async list(ownerId) {
    const records = await db.canonical_records.where('owner_id').equals(ownerId).toArray();
    return records
      .map(record => V2RecordSchema.parse(record))
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  async seal(input: SealRecordInput) {
    return db.transaction('rw', db.canonical_records, async () => {
      const existing = await db.canonical_records.get(input.id);
      if (existing) {
        if (existing.owner_id !== input.owner_id) {
          throw new CanonicalOwnershipError('Cannot reuse a canonical record id across owners.');
        }
        // Safe retry: the exact same seal operation is idempotent. A retry that
        // attempts different original content is rejected rather than replacing it.
        if (
          existing.kind !== input.kind
          || existing.captured_at !== input.captured_at
          || existing.sealed_at !== input.sealed_at
          || !same(existing.original, input.original)
        ) {
          throw new CanonicalImmutableConflictError('A sealed canonical record cannot be replaced.');
        }
        return V2RecordSchema.parse(existing);
      }

      const record: V2Record = {
        id: input.id,
        owner_id: input.owner_id,
        kind: input.kind,
        schema_version: V2_SCHEMA_VERSION,
        original: structuredClone(input.original),
        details: {
          title: null,
          category_id: null,
          context: null,
          person_ids: [],
          location: null,
          event_date: input.kind === 'daily'
            ? { kind: 'exact', date: input.sealed_at.slice(0, 10) }
            : null,
          event_time: null,
          revision_count: 0,
        },
        lifecycle: { state: 'sealed' },
        dossier: { state: 'not_included' },
        captured_at: input.captured_at,
        sealed_at: input.sealed_at,
        created_at: input.sealed_at,
        updated_at: input.sealed_at,
        sync: {
          remote_version: null,
          local_revision: 0,
          state: { state: 'local_only' },
          last_attempt_at: null,
        },
      };

      const validated = V2RecordSchema.parse(record);
      await db.canonical_records.add(validated);
      return validated;
    });
  },

  async updateDetails(ownerId, recordId, expectedRevision, patch) {
    CanonicalRecordMutationSchema.parse({
      kind: 'update_details', owner_id: ownerId, record_id: recordId, expected_revision: expectedRevision, patch,
    });

    return db.transaction('rw', db.canonical_records, async () => {
      const current = active(owned(await db.canonical_records.get(recordId), ownerId, recordId));
      if (current.details.revision_count !== expectedRevision) {
        throw new CanonicalRevisionConflictError(
          `Expected details revision ${expectedRevision}, found ${current.details.revision_count}.`,
        );
      }

      const nextDetails: OrganisationalDetails = {
        ...current.details,
        ...structuredClone(patch),
        revision_count: current.details.revision_count + 1,
      };
      const next: V2Record = {
        ...current,
        original: structuredClone(current.original),
        details: nextDetails,
        updated_at: clock(),
        sync: localOnlySync(current.sync),
      };
      const validated = V2RecordSchema.parse(next);
      await db.canonical_records.put(validated);
      return validated;
    });
  },

  async appendClarification(value: V2Clarification) {
    CanonicalRecordMutationSchema.parse({
      kind: 'append_clarification',
      owner_id: value.owner_id,
      record_id: value.record_id,
      clarification_id: value.id,
      clarification_kind: value.kind,
      text: value.text,
      created_at: value.created_at,
    });

    await db.transaction('rw', db.canonical_records, db.canonical_clarifications, async () => {
      const parent = active(owned(await db.canonical_records.get(value.record_id), value.owner_id, value.record_id));
      ensureChildIdentity(parent, value);
      const existing = await db.canonical_clarifications.get(value.id);
      if (existing) {
        if (!same(existing, value)) throw new CanonicalImmutableConflictError('Clarification id already has different content.');
        return;
      }
      await db.canonical_clarifications.add(structuredClone(value));
    });
  },

  async setDossierMembership(ownerId, recordId, membership: DossierMembership) {
    CanonicalRecordMutationSchema.parse({
      kind: 'set_dossier_membership', owner_id: ownerId, record_id: recordId, membership,
    });

    await db.transaction('rw', db.canonical_records, async () => {
      const current = active(owned(await db.canonical_records.get(recordId), ownerId, recordId));
      const next: V2Record = {
        ...current,
        original: structuredClone(current.original),
        details: structuredClone(current.details),
        dossier: structuredClone(membership),
        updated_at: clock(),
        sync: localOnlySync(current.sync),
      };
      await db.canonical_records.put(V2RecordSchema.parse(next));
    });
  },

  async storeOriginalMedia(value: V2Media, bytes: ArrayBuffer) {
    const validated = V2MediaSchema.parse(value);
    if (validated.role !== 'original') {
      throw new CanonicalImmutableConflictError('Only media committed at seal may use original-media recovery.');
    }
    if (!validated.content_hash) {
      throw new CanonicalImmutableConflictError('Original media must have an integrity hash before storage.');
    }
    if (bytes.byteLength !== validated.size) {
      throw new CanonicalImmutableConflictError('Original media bytes do not match the committed size.');
    }

    await db.transaction('rw', db.canonical_records, db.canonical_media, db.canonical_blobs, async () => {
      const parent = active(owned(await db.canonical_records.get(validated.record_id), validated.owner_id, validated.record_id));
      ensureChildIdentity(parent, validated);
      if (!parent.original.media_ids.includes(validated.id)) {
        throw new CanonicalImmutableConflictError('Original media id was not committed when the record was sealed.');
      }
      if (validated.added_at !== parent.sealed_at) {
        throw new CanonicalImmutableConflictError('Original media timestamp must equal the record seal timestamp.');
      }

      const existingMedia = await db.canonical_media.get(validated.id);
      const existingBytes = await db.canonical_blobs.get(validated.id);
      if (existingMedia && !same(existingMedia, validated)) {
        throw new CanonicalImmutableConflictError('Original media id already has different metadata.');
      }
      if (existingBytes && (
        existingBytes.owner_id !== validated.owner_id
        || existingBytes.record_id !== validated.record_id
        || existingBytes.size !== bytes.byteLength
        || existingBytes.mime !== validated.mime
      )) {
        throw new CanonicalImmutableConflictError('Original media id already has different bytes.');
      }

      if (!existingMedia) await db.canonical_media.add(validated);
      if (!existingBytes) {
        await db.canonical_blobs.add({
          id: validated.id,
          owner_id: validated.owner_id,
          record_id: validated.record_id,
          bytes: bytes.slice(0),
          mime: validated.mime,
          size: bytes.byteLength,
          stored_at: clock(),
        });
      }
    });
  },

  async appendMedia(value: V2Media) {
    const validated = V2MediaSchema.parse(value);
    if (validated.role === 'original') {
      throw new CanonicalImmutableConflictError(
        'Original media must be part of the seal operation; it cannot be appended after seal.',
      );
    }

    await db.transaction('rw', db.canonical_records, db.canonical_media, async () => {
      const parent = active(owned(await db.canonical_records.get(validated.record_id), validated.owner_id, validated.record_id));
      ensureChildIdentity(parent, validated);
      const existing = await db.canonical_media.get(validated.id);
      if (existing) {
        if (!same(existing, validated)) throw new CanonicalImmutableConflictError('Media id already has different content.');
        return;
      }
      await db.canonical_media.add(validated);
    });
  },

  async appendHistory(value: V2RecordEvent) {
    await db.transaction('rw', db.canonical_records, db.canonical_history, async () => {
      const parent = owned(await db.canonical_records.get(value.record_id), value.owner_id, value.record_id);
      ensureChildIdentity(parent, value);
      const existing = await db.canonical_history.get(value.id);
      if (existing) {
        if (!same(existing, value)) throw new CanonicalImmutableConflictError('History event id already has different content.');
        return;
      }
      await db.canonical_history.add(structuredClone(value));
    });
  },
});

/** Default Phase 3 repository. Nothing imports this into production flows yet. */
export const canonicalLocalRepository = createCanonicalLocalRepository();
