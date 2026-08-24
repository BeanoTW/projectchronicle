import { localDB } from '@/local/db';
import { getCanonicalActivation } from './canonicalActivation';
import type { V2Person } from './schema';

const normalise = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const requireActivation = async (ownerId: string): Promise<void> => {
  if (!await getCanonicalActivation(ownerId)) throw new Error('Canonical people writes require an audited activation marker.');
};

/** Owner-scoped person registry. Reuses an existing active identity for the same normalised name. */
export const canonicalPersonWriter = {
  async ensure(ownerId: string, displayName: string, roleNote: string | null = null): Promise<V2Person> {
    await requireActivation(ownerId);
    const clean = displayName.trim().replace(/\s+/g, ' ');
    if (!clean) throw new Error('Person name cannot be empty.');
    const normalised = normalise(clean);
    const existing = await localDB.canonical_people
      .where('owner_id').equals(ownerId)
      .filter(person => person.normalised_name === normalised && person.merged_into_id === null)
      .first();
    if (existing) return existing;

    const person: V2Person = {
      id: crypto.randomUUID(), owner_id: ownerId, display_name: clean, normalised_name: normalised,
      role_note: roleNote?.trim() || null, created_at: new Date().toISOString(), merged_into_id: null,
    };
    await localDB.canonical_people.add(person);
    return person;
  },
};
