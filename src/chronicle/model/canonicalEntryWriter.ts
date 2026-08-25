import { CanonicalRecordMutationSchema, V2RecordSchema } from './contracts';
import { getCanonicalActivation, type CanonicalActivationReceipt } from './canonicalActivation';
import {
  CanonicalLifecycleError,
  CanonicalNotFoundError,
  CanonicalOwnershipError,
  CanonicalRevisionConflictError,
} from './canonicalLocalRepository';
import type { ClarificationKind, DossierMembership, OrganisationalDetails, SyncMetadata, V2Clarification, V2Record, V2RecordEvent } from './schema';
import { ChronicleDB, localDB } from '@/local/db';

export class CanonicalWriteNotActiveError extends Error {}

const localOnlySync = (previous?: SyncMetadata): SyncMetadata => ({
  remote_version: previous?.remote_version ?? null,
  local_revision: (previous?.local_revision ?? 0) + 1,
  state: { state: 'local_only' },
  last_attempt_at: previous?.last_attempt_at ?? null,
});

const ownedActive = (record: V2Record | undefined, ownerId: string, recordId: string): V2Record => {
  if (!record) throw new CanonicalNotFoundError(`Canonical record ${recordId} was not found.`);
  if (record.owner_id !== ownerId) throw new CanonicalOwnershipError('Canonical record belongs to another owner.');
  if (record.lifecycle.state !== 'sealed') throw new CanonicalLifecycleError(`Canonical record is ${record.lifecycle.state} and cannot be changed.`);
  return record;
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const createCanonicalEntryWriter = (
  db: ChronicleDB = localDB,
  activationFor: (ownerId: string) => Promise<CanonicalActivationReceipt | null> = ownerId => getCanonicalActivation(ownerId, db),
  clock: () => string = () => new Date().toISOString(),
  idFactory: () => string = () => crypto.randomUUID(),
) => {
  const requireActivation = async (ownerId: string): Promise<void> => {
    if (!await activationFor(ownerId)) throw new CanonicalWriteNotActiveError('Canonical writes require an audited activation marker.');
  };
  const history = (ownerId: string, recordId: string, action: V2RecordEvent['action'], at: string, field: string | null = null): V2RecordEvent => ({
    id: idFactory(), record_id: recordId, owner_id: ownerId, at, action, field,
    from_value: null, to_value: null, actor: 'user',
  });

  return {
    async addClarification(ownerId: string, recordId: string, text: string, kind: ClarificationKind = 'clarification'): Promise<V2Clarification> {
      await requireActivation(ownerId);
      const body = text.trim();
      if (!body) throw new Error('Clarification cannot be empty.');
      const at = clock();
      const clarification: V2Clarification = {
        id: idFactory(), record_id: recordId, owner_id: ownerId, kind, text: body, created_at: at,
        sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
      };
      CanonicalRecordMutationSchema.parse({ kind: 'append_clarification', owner_id: ownerId, record_id: recordId, clarification_id: clarification.id, clarification_kind: clarification.kind, text: clarification.text, created_at: at });
      await db.transaction('rw', db.canonical_records, db.canonical_clarifications, db.canonical_history, async () => {
        ownedActive(await db.canonical_records.get(recordId), ownerId, recordId);
        await db.canonical_clarifications.add(clarification);
        await db.canonical_history.add(history(ownerId, recordId, 'clarification_added', at));
      });
      return clarification;
    },

    async setChronicleMembership(ownerId: string, recordId: string, included: boolean): Promise<void> {
      await requireActivation(ownerId);
      const at = clock();
      const membership: DossierMembership = included ? { state: 'included', included_at: at } : { state: 'not_included' };
      CanonicalRecordMutationSchema.parse({ kind: 'set_dossier_membership', owner_id: ownerId, record_id: recordId, membership });
      await db.transaction('rw', db.canonical_records, db.canonical_history, async () => {
        const current = ownedActive(await db.canonical_records.get(recordId), ownerId, recordId);
        if ((included && current.dossier.state === 'included') || (!included && current.dossier.state !== 'included')) return;
        const next = V2RecordSchema.parse({ ...current, original: structuredClone(current.original), details: structuredClone(current.details), dossier: membership, updated_at: at, sync: localOnlySync(current.sync) });
        await db.canonical_records.put(next);
        await db.canonical_history.add(history(ownerId, recordId, included ? 'dossier_included' : 'dossier_excluded', at));
      });
    },

    async updateDetails(ownerId: string, record: V2Record, patch: Partial<Omit<OrganisationalDetails, 'revision_count'>>): Promise<V2Record> {
      await requireActivation(ownerId);
      CanonicalRecordMutationSchema.parse({ kind: 'update_details', owner_id: ownerId, record_id: record.id, expected_revision: record.details.revision_count, patch });
      const at = clock();
      return db.transaction('rw', db.canonical_records, db.canonical_history, async () => {
        const current = ownedActive(await db.canonical_records.get(record.id), ownerId, record.id);
        if (current.details.revision_count !== record.details.revision_count) {
          throw new CanonicalRevisionConflictError(`Expected details revision ${record.details.revision_count}, found ${current.details.revision_count}.`);
        }
        const changedPatch = Object.fromEntries(Object.entries(patch).filter(([key, value]) => !same(current.details[key as keyof OrganisationalDetails], value))) as Partial<Omit<OrganisationalDetails, 'revision_count'>>;
        if (Object.keys(changedPatch).length === 0) return current;
        const next = V2RecordSchema.parse({
          ...current,
          original: structuredClone(current.original),
          details: { ...current.details, ...structuredClone(changedPatch), revision_count: current.details.revision_count + 1 },
          updated_at: at,
          sync: localOnlySync(current.sync),
        });
        await db.canonical_records.put(next);
        for (const field of Object.keys(changedPatch).sort()) await db.canonical_history.add(history(ownerId, record.id, 'details_updated', at, field));
        return next;
      });
    },

    async archive(ownerId: string, recordId: string, reason?: string): Promise<V2Record> {
      await requireActivation(ownerId);
      const at = clock();
      CanonicalRecordMutationSchema.parse({ kind: 'archive_record', owner_id: ownerId, record_id: recordId, reason });
      return db.transaction('rw', db.canonical_records, db.canonical_history, async () => {
        const current = await db.canonical_records.get(recordId);
        if (!current) throw new CanonicalNotFoundError(`Canonical record ${recordId} was not found.`);
        if (current.owner_id !== ownerId) throw new CanonicalOwnershipError('Canonical record belongs to another owner.');
        if (current.lifecycle.state === 'archived') return current;
        if (current.lifecycle.state !== 'sealed') throw new CanonicalLifecycleError(`Canonical record is ${current.lifecycle.state} and cannot be archived.`);
        const next = V2RecordSchema.parse({ ...current, original: structuredClone(current.original), details: structuredClone(current.details), lifecycle: { state: 'archived', archived_at: at, ...(reason ? { reason } : {}) }, updated_at: at, sync: localOnlySync(current.sync) });
        await db.canonical_records.put(next);
        await db.canonical_history.add(history(ownerId, recordId, 'archived', at));
        return next;
      });
    },

    async restore(ownerId: string, recordId: string): Promise<V2Record> {
      await requireActivation(ownerId);
      const at = clock();
      CanonicalRecordMutationSchema.parse({ kind: 'restore_record', owner_id: ownerId, record_id: recordId });
      return db.transaction('rw', db.canonical_records, db.canonical_history, async () => {
        const current = await db.canonical_records.get(recordId);
        if (!current) throw new CanonicalNotFoundError(`Canonical record ${recordId} was not found.`);
        if (current.owner_id !== ownerId) throw new CanonicalOwnershipError('Canonical record belongs to another owner.');
        if (current.lifecycle.state === 'sealed') return current;
        if (current.lifecycle.state !== 'archived') throw new CanonicalLifecycleError(`Canonical record is ${current.lifecycle.state} and cannot be restored.`);
        const next = V2RecordSchema.parse({ ...current, original: structuredClone(current.original), details: structuredClone(current.details), lifecycle: { state: 'sealed' }, updated_at: at, sync: localOnlySync(current.sync) });
        await db.canonical_records.put(next);
        await db.canonical_history.add(history(ownerId, recordId, 'restored', at));
        return next;
      });
    },
  };
};

export const canonicalEntryWriter = createCanonicalEntryWriter();
