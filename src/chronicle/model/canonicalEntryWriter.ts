import { getCanonicalActivation } from './canonicalActivation';
import { canonicalLocalRepository } from './canonicalLocalRepository';
import type { DossierMembership, V2Clarification, V2Record, V2RecordEvent } from './schema';

export class CanonicalWriteNotActiveError extends Error {}

const requireActivation = async (ownerId: string): Promise<void> => {
  if (!await getCanonicalActivation(ownerId)) {
    throw new CanonicalWriteNotActiveError('Canonical writes require an audited activation marker.');
  }
};

const uuid = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();
const childSync = () => ({ remote_version: null, local_revision: 0, state: { state: 'local_only' as const }, last_attempt_at: null });

const appendEvent = async (
  ownerId: string,
  recordId: string,
  action: V2RecordEvent['action'],
  at: string,
  field: string | null = null,
): Promise<void> => canonicalLocalRepository.appendHistory({
  id: uuid(), record_id: recordId, owner_id: ownerId, at, action, field,
  from_value: null, to_value: null, actor: 'user',
});

/** UI-facing write authority after canonical activation. Never falls back to V1. */
export const canonicalEntryWriter = {
  async addClarification(ownerId: string, recordId: string, text: string): Promise<V2Clarification> {
    await requireActivation(ownerId);
    const body = text.trim();
    if (!body) throw new Error('Clarification cannot be empty.');
    const at = now();
    const clarification: V2Clarification = {
      id: uuid(), record_id: recordId, owner_id: ownerId, kind: 'clarification', text: body, created_at: at, sync: childSync(),
    };
    await canonicalLocalRepository.appendClarification(clarification);
    await appendEvent(ownerId, recordId, 'clarification_added', at);
    return clarification;
  },

  async setChronicleMembership(ownerId: string, recordId: string, included: boolean): Promise<void> {
    await requireActivation(ownerId);
    const at = now();
    const membership: DossierMembership = included ? { state: 'included', included_at: at } : { state: 'not_included' };
    await canonicalLocalRepository.setDossierMembership(ownerId, recordId, membership);
    await appendEvent(ownerId, recordId, included ? 'dossier_included' : 'dossier_excluded', at);
  },

  async updateDetails(
    ownerId: string,
    record: V2Record,
    patch: Parameters<typeof canonicalLocalRepository.updateDetails>[3],
  ): Promise<V2Record> {
    await requireActivation(ownerId);
    const next = await canonicalLocalRepository.updateDetails(ownerId, record.id, record.details.revision_count, patch);
    const at = now();
    for (const field of Object.keys(patch)) await appendEvent(ownerId, record.id, 'details_updated', at, field);
    return next;
  },
};
