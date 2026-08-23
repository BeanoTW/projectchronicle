// Phase 5 — audited activation gate and source router.
//
// Canonical storage exists before this phase, but it is not trusted for reads
// until an owner-specific audit proves the migrated canonical rows exactly match
// the preflighted migration build and no unresolved migration issue remains.
import type { CanonicalRecordReader } from './adapters';
import type { CanonicalMigrationBuild } from './canonicalMigration';
import { canonicalLocalRepository } from './canonicalLocalRepository';
import { legacyCompatibilityReader } from './legacyReader';
import { ChronicleDB, localDB } from '@/local/db';

export const CANONICAL_ACTIVATION_VERSION = 1;

export interface CanonicalActivationReceipt {
  version: typeof CANONICAL_ACTIVATION_VERSION;
  owner_id: string;
  state: 'canonical';
  activated_at: string;
  counts: {
    records: number;
    clarifications: number;
    media: number;
    history: number;
    people: number;
    relationships: number;
  };
  inspected: CanonicalMigrationBuild['inspected'];
}

export class CanonicalActivationBlockedError extends Error {
  constructor(public readonly reasons: readonly string[]) {
    super(`Canonical activation blocked: ${reasons.join('; ')}`);
  }
}

export const canonicalActivationKey = (ownerId: string): string => `canonical_activation:${ownerId}`;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const ownerRows = <T extends { owner_id: string }>(rows: readonly T[], ownerId: string): readonly T[] =>
  rows.filter(row => row.owner_id === ownerId).sort((a, b) => ('id' in a && 'id' in b ? String(a.id).localeCompare(String(b.id)) : 0));

const checkTable = async <T extends { id: string; owner_id: string }>(
  label: string,
  expected: readonly T[],
  actual: readonly T[],
): Promise<string[]> => {
  const reasons: string[] = [];
  const expectedById = new Map(expected.map(row => [row.id, row]));
  const actualById = new Map(actual.map(row => [row.id, row]));

  for (const row of expected) {
    const stored = actualById.get(row.id);
    if (!stored) reasons.push(`${label}:${row.id} is missing`);
    else if (!same(stored, row)) reasons.push(`${label}:${row.id} differs from the audited migration build`);
  }
  for (const row of actual) {
    if (!expectedById.has(row.id)) reasons.push(`${label}:${row.id} is unexpected before activation`);
  }
  return reasons;
};

/**
 * Audits one owner against a migration build. `requires_handling` is treated as
 * activation-blocking: rows may remain safely in V1, but Chronicle must not
 * switch the account to a canonical-only read path while they are unresolved.
 */
export const auditCanonicalActivation = async (
  build: CanonicalMigrationBuild,
  ownerId: string,
  db: ChronicleDB = localDB,
): Promise<{ ok: true; counts: CanonicalActivationReceipt['counts'] } | { ok: false; reasons: readonly string[] }> => {
  const reasons: string[] = [];
  const unresolved = build.issues.filter(issue => issue.severity !== 'safe');
  unresolved.forEach(issue => reasons.push(`${issue.source}:${issue.source_id}:${issue.code}`));

  const expected = {
    records: ownerRows(build.records, ownerId),
    clarifications: ownerRows(build.clarifications, ownerId),
    media: ownerRows(build.media, ownerId),
    history: ownerRows(build.history, ownerId),
    people: ownerRows(build.people, ownerId),
    relationships: ownerRows(build.relationships, ownerId),
  };

  const actual = {
    records: await db.canonical_records.where('owner_id').equals(ownerId).toArray(),
    clarifications: await db.canonical_clarifications.where('owner_id').equals(ownerId).toArray(),
    media: await db.canonical_media.where('owner_id').equals(ownerId).toArray(),
    history: await db.canonical_history.where('owner_id').equals(ownerId).toArray(),
    people: await db.canonical_people.where('owner_id').equals(ownerId).toArray(),
    relationships: await db.canonical_relationships.where('owner_id').equals(ownerId).toArray(),
  };

  reasons.push(...await checkTable('record', expected.records, actual.records));
  reasons.push(...await checkTable('clarification', expected.clarifications, actual.clarifications));
  reasons.push(...await checkTable('media', expected.media, actual.media));
  reasons.push(...await checkTable('history', expected.history, actual.history));
  reasons.push(...await checkTable('person', expected.people, actual.people));
  reasons.push(...await checkTable('relationship', expected.relationships, actual.relationships));

  if (reasons.length > 0) return { ok: false, reasons: [...new Set(reasons)].sort() };

  return {
    ok: true,
    counts: {
      records: expected.records.length,
      clarifications: expected.clarifications.length,
      media: expected.media.length,
      history: expected.history.length,
      people: expected.people.length,
      relationships: expected.relationships.length,
    },
  };
};

/** Writes the activation marker only after the exact audit succeeds. */
export const activateCanonicalOwner = async (
  build: CanonicalMigrationBuild,
  ownerId: string,
  db: ChronicleDB = localDB,
  clock: () => string = () => new Date().toISOString(),
): Promise<CanonicalActivationReceipt> => {
  const audit = await auditCanonicalActivation(build, ownerId, db);
  if (!audit.ok) throw new CanonicalActivationBlockedError(audit.reasons);

  const receipt: CanonicalActivationReceipt = {
    version: CANONICAL_ACTIVATION_VERSION,
    owner_id: ownerId,
    state: 'canonical',
    activated_at: clock(),
    counts: audit.counts,
    inspected: structuredClone(build.inspected),
  };
  await db.meta.put({ key: canonicalActivationKey(ownerId), value: JSON.stringify(receipt) });
  return receipt;
};

export const getCanonicalActivation = async (
  ownerId: string,
  db: ChronicleDB = localDB,
): Promise<CanonicalActivationReceipt | null> => {
  const row = await db.meta.get(canonicalActivationKey(ownerId));
  if (!row) return null;
  try {
    const value = JSON.parse(row.value) as Partial<CanonicalActivationReceipt>;
    if (
      value.version !== CANONICAL_ACTIVATION_VERSION
      || value.owner_id !== ownerId
      || value.state !== 'canonical'
      || typeof value.activated_at !== 'string'
      || !value.counts
      || !value.inspected
    ) return null;
    return value as CanonicalActivationReceipt;
  } catch {
    return null;
  }
};

/**
 * Routing remains legacy-by-default. A malformed/missing/stale activation
 * receipt never opts the user into canonical reads.
 */
export const createCanonicalReadRouter = (
  legacyReader: CanonicalRecordReader,
  canonicalReader: CanonicalRecordReader,
  activationFor: (ownerId: string) => Promise<CanonicalActivationReceipt | null>,
): CanonicalRecordReader => ({
  async get(ownerId, recordId) {
    return (await activationFor(ownerId) ? canonicalReader : legacyReader).get(ownerId, recordId);
  },
  async list(ownerId) {
    return (await activationFor(ownerId) ? canonicalReader : legacyReader).list(ownerId);
  },
});

/** Not wired into production screens yet; Phase 6 can adopt this port explicitly. */
export const canonicalReadRouter = createCanonicalReadRouter(
  legacyCompatibilityReader,
  canonicalLocalRepository,
  ownerId => getCanonicalActivation(ownerId),
);
