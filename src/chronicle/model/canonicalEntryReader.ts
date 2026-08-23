import { canonicalReadRouter, getCanonicalActivation } from './canonicalActivation';
import type { V2Clarification, V2Media, V2Person, V2Record, V2RecordEvent } from './schema';
import { localDB } from '@/local/db';

export interface CanonicalEntryBundle {
  record: V2Record;
  people: readonly V2Person[];
  clarifications: readonly V2Clarification[];
  media: readonly V2Media[];
  history: readonly V2RecordEvent[];
  source: 'legacy' | 'canonical';
}

/**
 * Reads one record through the Phase 5 activation gate. Child tables are only
 * joined after canonical activation. Before activation the canonical record
 * projection is still safe to display, but legacy child hooks remain the
 * authority for notes/evidence/history until their migration has been audited.
 */
export const readCanonicalEntryBundle = async (
  ownerId: string,
  recordId: string,
): Promise<CanonicalEntryBundle | null> => {
  const record = await canonicalReadRouter.get(ownerId, recordId);
  if (!record) return null;

  const activation = await getCanonicalActivation(ownerId);
  if (!activation) return { record, people: [], clarifications: [], media: [], history: [], source: 'legacy' };

  const [people, clarifications, media, history] = await Promise.all([
    localDB.canonical_people.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_clarifications.where('record_id').equals(recordId).toArray(),
    localDB.canonical_media.where('record_id').equals(recordId).toArray(),
    localDB.canonical_history.where('record_id').equals(recordId).toArray(),
  ]);

  // IndexedDB indexes are not an authorization boundary. Re-check ownership and
  // record linkage in memory before anything reaches the UI.
  return {
    record,
    people: people.filter(person => person.owner_id === ownerId && record.details.person_ids.includes(person.id)),
    clarifications: clarifications
      .filter(row => row.owner_id === ownerId && row.record_id === recordId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    media: media
      .filter(row => row.owner_id === ownerId && row.record_id === recordId)
      .sort((a, b) => a.added_at.localeCompare(b.added_at)),
    history: history
      .filter(row => row.owner_id === ownerId && row.record_id === recordId)
      .sort((a, b) => a.at.localeCompare(b.at)),
    source: 'canonical',
  };
};
