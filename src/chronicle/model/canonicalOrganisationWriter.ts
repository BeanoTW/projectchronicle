import { localDB } from '@/local/db';
import { getCanonicalActivation } from './canonicalActivation';
import type { V2Organisation } from './schema';

const normalise = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const requireActivation = async (ownerId: string): Promise<void> => {
  if (!await getCanonicalActivation(ownerId)) throw new Error('Canonical organisation writes require an audited activation marker.');
};

/** Owner-scoped organisation registry with non-destructive identity reuse. */
export const canonicalOrganisationWriter = {
  async ensure(ownerId: string, displayName: string, note: string | null = null): Promise<V2Organisation> {
    await requireActivation(ownerId);
    const clean = displayName.trim().replace(/\s+/g, ' ');
    if (!clean) throw new Error('Organisation name cannot be empty.');
    const normalised = normalise(clean);
    const existing = await localDB.canonical_organisations.where('owner_id').equals(ownerId)
      .filter(item => item.normalised_name === normalised && item.merged_into_id === null).first();
    if (existing) return existing;
    const organisation: V2Organisation = {
      id: crypto.randomUUID(), owner_id: ownerId, display_name: clean, normalised_name: normalised,
      note: note?.trim() || null, created_at: new Date().toISOString(), merged_into_id: null,
    };
    await localDB.canonical_organisations.add(organisation);
    return organisation;
  },
};
