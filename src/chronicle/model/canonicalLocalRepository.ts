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
  if (record.lifecycle.state !== 'sealed') throw new CanonicalLifecycleError(`Canonical record is ${record.lifecycle.state} and cannot be changed.`);
  return record;
};

const ensureChildIdentity = (parent: V2Record, child: { owner_id: string; record_id: string }): void => {
  if (child.owner_id !== parent.owner_id || child.record_id !== parent.id) throw new CanonicalOwnershipError('Canonical child row does not match its owner and record.');
};

export const createCanonicalLocalRepository = (
  db: ChronicleDB = localDB,
  clock: () => string = () => new Date().toISOString(),
  idFactory: () => string = () => crypto.randomUUID(),
): CanonicalRecordReader & CanonicalRecordWriter => ({
  async get(ownerId, recordId) {
    const record = await db.canonical_records.get(recordId);
    if (!record || record.owner_id !== ownerId) return null;
    return V2RecordSchema.parse(record);
  },

  async list(ownerId) {
    const records = await db.canonical_records.where('owner_id').equals(ownerId).toArray();
    return records.map(record => V2RecordSchema.parse(record)).sort((a, b) => a.id.localeCompare(b.id));
  },

  async seal(input: SealRecordInput) {
    return db.transaction('rw', db.canonical_records, db.canonical_history, async () => {
      const existing = await db.canonical_records.get(input.id);
      if (existing) {
        if (existing.owner_id !== input.owner_id) throw new CanonicalOwnershipError('Cannot reuse a canonical record id across owners.');
        if (existing.kind !== input.kind || existing.captured_at !== input.captured_at || existing.sealed_at !== input.sealed_at || !same(existing.original, input.original)) {
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
          // Record kind is not an event date. Missing event date remains unknown.
          event_date: null,
          event_time: null,
          revision_count: 0,
        },
        lifecycle: { state: 'sealed' },
        dossier: { state: 'not_included' },
        captured_at: input.captured_at,
        sealed_at: input.sealed_at,
        created_at: input.sealed_at,
        updated_at: input.sealed_at,
        sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
      };

      const validated = V2RecordSchema.parse(record);
      await db.canonical_records.add(validated);
      await db.canonical_history.add({ id: idFactory(), record_id: validated.id, owner_id: validated.owner_id, at: validated.sealed_at, action: 'sealed', field: null, from_value: null, to_value: null, actor: 'user' });
      return validated;
    });
  },

  async updateDetails(ownerId, recordId, expectedRevision, patch) {
    CanonicalRecordMutationSchema.parse({ kind: 'update_details', owner_id: ownerId, record_id: recordId, expected_revision: expectedRevision, patch });
    return db.transaction('rw', db.canonical_records, async () => {
      const current = active(owned(await db.canonical_records.get(recordId), ownerId, recordId));
      if (current.details.revision_count !== expectedRevision) throw new CanonicalRevisionConflictError(`Expected details revision ${expectedRevision}, found ${current.details.revision_count}.`);
      const nextDetails: OrganisationalDetails = { ...current.details, ...structuredClone(patch), revision_count: current.details.revision_count + 1 };
      const next: V2Record = { ...current, details: nextDetails, updated_at: clock(), sync: localOnlySync(current.sync) };
      const validated = V2RecordSchema.parse(next);
      await db.canonical_records.put(validated);
      return validated;
    });
  },

  async setDossierMembership(ownerId, recordId, expectedState, membership: DossierMembership) {
    return db.transaction('rw', db.canonical_records, async () => {
      const current = active(owned(await db.canonical_records.get(recordId), ownerId, recordId));
      if (current.dossier.state !== expectedState) throw new CanonicalRevisionConflictError(`Expected dossier state ${expectedState}, found ${current.dossier.state}.`);
      const next = V2RecordSchema.parse({ ...current, dossier: structuredClone(membership), updated_at: clock(), sync: localOnlySync(current.sync) });
      await db.canonical_records.put(next);
      return next;
    });
  },

  async addClarification(value: V2Clarification) {
    const parent = active(owned(await db.canonical_records.get(value.record_id), value.owner_id, value.record_id));
    ensureChildIdentity(parent, value);
    const existing = await db.canonical_clarifications.get(value.id);
    if (existing) {
      if (!same(existing, value)) throw new CanonicalImmutableConflictError('Canonical clarification is append-only.');
      return existing;
    }
    await db.canonical_clarifications.add(structuredClone(value));
    return value;
  },

  async storeOriginalMedia(value: V2Media, bytes: ArrayBuffer) {
    const parent = active(owned(await db.canonical_records.get(value.record_id), value.owner_id, value.record_id));
    ensureChildIdentity(parent, value);
    if (!parent.original.media_ids.includes(value.id) || value.role !== 'original') throw new CanonicalImmutableConflictError('Original media must have been declared when the record was sealed.');
    const parsed = V2MediaSchema.parse(value);
    return db.transaction('rw', db.canonical_media, db.canonical_blobs, async () => {
      const existing = await db.canonical_media.get(value.id);
      if (existing) {
        const blob = await db.canonical_blobs.get(value.id);
        if (!same(existing, parsed) || !blob || blob.size !== bytes.byteLength) throw new CanonicalImmutableConflictError('Canonical original media cannot be replaced.');
        return parsed;
      }
      await db.canonical_media.add(parsed);
      await db.canonical_blobs.add({ id: value.id, owner_id: value.owner_id, record_id: value.record_id, bytes, mime: value.mime, size: bytes.byteLength, stored_at: value.added_at });
      return parsed;
    });
  },

  async appendHistory(event: V2RecordEvent) {
    const parent = owned(await db.canonical_records.get(event.record_id), event.owner_id, event.record_id);
    ensureChildIdentity(parent, event);
    const existing = await db.canonical_history.get(event.id);
    if (existing) { if (!same(existing, event)) throw new CanonicalImmutableConflictError('Canonical history is append-only.'); return existing; }
    await db.canonical_history.add(structuredClone(event));
    return event;
  },
});

export const canonicalLocalRepository = createCanonicalLocalRepository();
