import { canonicalReadRouter, getCanonicalActivation } from './canonicalActivation';
import type { V2Clarification, V2Media, V2Person, V2Record, V2RecordEvent, V2RecordRelationship } from './schema';
import { localDB } from '@/local/db';

export interface CanonicalEntryBundle {
  record: V2Record;
  people: readonly V2Person[];
  relationships: readonly V2RecordRelationship[];
  clarifications: readonly V2Clarification[];
  media: readonly V2Media[];
  history: readonly V2RecordEvent[];
  source: 'legacy' | 'canonical';
}

/** Reads one record through the audited canonical activation gate. */
export const readCanonicalEntryBundle = async (
  ownerId: string,
  recordId: string,
): Promise<CanonicalEntryBundle | null> => {
  const record = await canonicalReadRouter.get(ownerId, recordId);
  if (!record) return null;

  const activation = await getCanonicalActivation(ownerId);
  if (!activation) return { record, people: [], relationships: [], clarifications: [], media: [], history: [], source: 'legacy' };

  const [people, relationships, clarifications, media, history] = await Promise.all([
    localDB.canonical_people.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_relationships.where('record_id').equals(recordId).toArray(),
    localDB.canonical_clarifications.where('record_id').equals(recordId).toArray(),
    localDB.canonical_media.where('record_id').equals(recordId).toArray(),
    localDB.canonical_history.where('record_id').equals(recordId).toArray(),
  ]);

  const activeRelationships = relationships.filter(row => row.owner_id === ownerId && row.record_id === recordId && row.removed_at === null);
  const personIds = new Set([
    ...record.details.person_ids,
    ...activeRelationships.filter(row => row.entity_type === 'person').map(row => row.entity_id),
  ]);

  // IndexedDB indexes are not an authorization boundary. Re-check ownership and linkage in memory.
  return {
    record,
    people: people.filter(person => person.owner_id === ownerId && personIds.has(person.id) && person.merged_into_id === null),
    relationships: activeRelationships.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    clarifications: clarifications.filter(row => row.owner_id === ownerId && row.record_id === recordId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    media: media.filter(row => row.owner_id === ownerId && row.record_id === recordId).sort((a, b) => a.added_at.localeCompare(b.added_at)),
    history: history.filter(row => row.owner_id === ownerId && row.record_id === recordId).sort((a, b) => a.at.localeCompare(b.at)),
    source: 'canonical',
  };
};
