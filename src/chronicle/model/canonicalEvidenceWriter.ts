import { localDB } from '@/local/db';
import { getCanonicalActivation } from './canonicalActivation';
import { canonicalLocalRepository } from './canonicalLocalRepository';
import type { MediaInclusion, V2RecordEvent } from './schema';

const uuid = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

const requireActivation = async (ownerId: string): Promise<void> => {
  if (!await getCanonicalActivation(ownerId)) throw new Error('Canonical evidence writes require an audited activation marker.');
};

const event = (ownerId: string, recordId: string, at: string, field: string): V2RecordEvent => ({
  id: uuid(), record_id: recordId, owner_id: ownerId, at, action: 'details_updated', field,
  from_value: null, to_value: null, actor: 'user',
});

/** Mutates only evidence metadata. Media bytes, hashes and original-role evidence are never rewritten. */
export const canonicalEvidenceWriter = {
  async setDossierInclusion(ownerId: string, recordId: string, mediaId: string, included: boolean, reason?: string): Promise<void> {
    await requireActivation(ownerId);
    const record = await canonicalLocalRepository.get(ownerId, recordId);
    if (!record) throw new Error('Canonical record not found.');
    if (record.lifecycle.state !== 'sealed') throw new Error('Only sealed canonical records may be changed.');
    const media = await localDB.canonical_media.get(mediaId);
    if (!media || media.owner_id !== ownerId || media.record_id !== recordId) throw new Error('Canonical evidence not found.');
    const at = now();
    const inclusion: MediaInclusion = included
      ? { state: 'included' }
      : { state: 'excluded_from_dossier', excluded_at: at, ...(reason?.trim() ? { reason: reason.trim() } : {}) };
    if (JSON.stringify(media.inclusion) === JSON.stringify(inclusion)) return;
    await localDB.transaction('rw', localDB.canonical_media, localDB.canonical_history, async () => {
      await localDB.canonical_media.update(mediaId, { inclusion });
      await localDB.canonical_history.add(event(ownerId, recordId, at, included ? 'evidence_included' : 'evidence_excluded'));
    });
  },

  async describe(ownerId: string, recordId: string, mediaId: string, description: string | null): Promise<void> {
    await requireActivation(ownerId);
    const record = await canonicalLocalRepository.get(ownerId, recordId);
    if (!record) throw new Error('Canonical record not found.');
    if (record.lifecycle.state !== 'sealed') throw new Error('Only sealed canonical records may be changed.');
    const media = await localDB.canonical_media.get(mediaId);
    if (!media || media.owner_id !== ownerId || media.record_id !== recordId) throw new Error('Canonical evidence not found.');
    const next = description?.trim() || null;
    if (media.description === next) return;
    const at = now();
    await localDB.transaction('rw', localDB.canonical_media, localDB.canonical_history, async () => {
      await localDB.canonical_media.update(mediaId, { description: next });
      await localDB.canonical_history.add(event(ownerId, recordId, at, 'evidence_description'));
    });
  },
};
