import { localDB } from '@/local/db';
import { V2RecordSchema } from './contracts';
import { getCanonicalActivation } from './canonicalActivation';
import { canonicalLocalRepository } from './canonicalLocalRepository';
import type { SyncMetadata, V2RecordEvent, V2RecordRelationship } from './schema';

export class CanonicalRelationshipWriteNotActiveError extends Error {}

const requireActivation = async (ownerId: string): Promise<void> => {
  if (!await getCanonicalActivation(ownerId)) throw new CanonicalRelationshipWriteNotActiveError('Canonical relationship writes require an audited activation marker.');
};
const now = (): string => new Date().toISOString();
const uuid = (): string => crypto.randomUUID();
const localOnlySync = (previous: SyncMetadata): SyncMetadata => ({ ...previous, local_revision: previous.local_revision + 1, state: { state: 'local_only' } });
const history = (ownerId: string, recordId: string, at: string, field: string): V2RecordEvent => ({ id: uuid(), record_id: recordId, owner_id: ownerId, at, action: 'details_updated', field, from_value: null, to_value: null, actor: 'user' });

/** Relationship facts and the denormalised person_ids index change in one transaction. */
export const canonicalRelationshipWriter = {
  async add(ownerId: string, recordId: string, entityType: V2RecordRelationship['entity_type'], entityId: string, roleNote: string | null = null): Promise<V2RecordRelationship> {
    await requireActivation(ownerId);
    const record = await canonicalLocalRepository.get(ownerId, recordId);
    if (!record) throw new Error('Canonical record not found.');
    if (record.lifecycle.state !== 'sealed') throw new Error('Only sealed canonical records may be changed.');
    const existing = await localDB.canonical_relationships.where('record_id').equals(recordId).filter(row => row.owner_id === ownerId && row.entity_type === entityType && row.entity_id === entityId && row.removed_at === null).first();
    if (existing) return existing;

    const at = now();
    const relationship: V2RecordRelationship = { id: uuid(), owner_id: ownerId, record_id: recordId, entity_type: entityType, entity_id: entityId, role_note: roleNote?.trim() || null, source: 'user', created_at: at, removed_at: null };
    await localDB.transaction('rw', localDB.canonical_records, localDB.canonical_relationships, localDB.canonical_history, async () => {
      const current = await localDB.canonical_records.get(recordId);
      if (!current || current.owner_id !== ownerId || current.lifecycle.state !== 'sealed') throw new Error('Canonical record is no longer mutable.');
      await localDB.canonical_relationships.add(relationship);
      if (entityType === 'person' && !current.details.person_ids.includes(entityId)) {
        const next = V2RecordSchema.parse({ ...current, details: { ...current.details, person_ids: [...current.details.person_ids, entityId], revision_count: current.details.revision_count + 1 }, updated_at: at, sync: localOnlySync(current.sync) });
        await localDB.canonical_records.put(next);
      }
      await localDB.canonical_history.add(history(ownerId, recordId, at, `${entityType}_relationship_added`));
    });
    return relationship;
  },

  async remove(ownerId: string, recordId: string, relationshipId: string): Promise<void> {
    await requireActivation(ownerId);
    const record = await canonicalLocalRepository.get(ownerId, recordId);
    if (!record) throw new Error('Canonical record not found.');
    if (record.lifecycle.state !== 'sealed') throw new Error('Only sealed canonical records may be changed.');
    const relationship = await localDB.canonical_relationships.get(relationshipId);
    if (!relationship || relationship.owner_id !== ownerId || relationship.record_id !== recordId || relationship.removed_at) return;
    const at = now();
    await localDB.transaction('rw', localDB.canonical_records, localDB.canonical_relationships, localDB.canonical_history, async () => {
      const current = await localDB.canonical_records.get(recordId);
      if (!current || current.owner_id !== ownerId || current.lifecycle.state !== 'sealed') throw new Error('Canonical record is no longer mutable.');
      await localDB.canonical_relationships.update(relationshipId, { removed_at: at });
      if (relationship.entity_type === 'person' && current.details.person_ids.includes(relationship.entity_id)) {
        const stillLinked = await localDB.canonical_relationships.where('record_id').equals(recordId).filter(row => row.id !== relationshipId && row.owner_id === ownerId && row.entity_type === 'person' && row.entity_id === relationship.entity_id && row.removed_at === null).first();
        if (!stillLinked) {
          const next = V2RecordSchema.parse({ ...current, details: { ...current.details, person_ids: current.details.person_ids.filter(id => id !== relationship.entity_id), revision_count: current.details.revision_count + 1 }, updated_at: at, sync: localOnlySync(current.sync) });
          await localDB.canonical_records.put(next);
        }
      }
      await localDB.canonical_history.add(history(ownerId, recordId, at, `${relationship.entity_type}_relationship_removed`));
    });
  },
};
