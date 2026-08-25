import { supabase } from '@/integrations/supabase/client';
import { getMeta, localDB, META_KEYS, setMeta } from '@/local/db';
import type { SyncMetadata } from '../model/schema';

export interface CanonicalCloudDiagnostics {
  localCount: number;
  cloudCount: number | null;
  cloudLastUpdatedAt: string | null;
  pendingCount: number;
  conflictCount: number;
  lastSyncAttemptAt: string | null;
  lastBackupAt: string | null;
  lastRestoreAt: string | null;
}

const isConflict = (sync: SyncMetadata): boolean => sync.state.state === 'conflict';
const isPending = (sync: SyncMetadata): boolean => sync.state.state !== 'synced';
const laterThan = (value: string | null | undefined, baseline: string | null): boolean => {
  if (!baseline) return true;
  if (!value) return true;
  return new Date(value).getTime() > new Date(baseline).getTime();
};
const maxIso = (values: Array<string | null | undefined>): string | null => {
  const present = values.filter((value): value is string => !!value && !Number.isNaN(new Date(value).getTime()));
  if (!present.length) return null;
  return present.reduce((latest, value) => new Date(value).getTime() > new Date(latest).getTime() ? value : latest);
};

export async function setCanonicalBackupSucceeded(ownerId: string, at: string): Promise<void> {
  await setMeta(META_KEYS.canonicalLastBackupAt(ownerId), at);
}

export async function setCanonicalRestoreSucceeded(ownerId: string, at: string): Promise<void> {
  await setMeta(META_KEYS.canonicalLastRestoreAt(ownerId), at);
}

export async function getCanonicalLocalDiagnostics(ownerId: string): Promise<Omit<CanonicalCloudDiagnostics, 'cloudCount' | 'cloudLastUpdatedAt'>> {
  const [records, clarifications, media, history, people, organisations, relationships, lastBackupAt, lastRestoreAt] = await Promise.all([
    localDB.canonical_records.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_clarifications.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_media.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_history.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_people.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_organisations.where('owner_id').equals(ownerId).toArray(),
    localDB.canonical_relationships.where('owner_id').equals(ownerId).toArray(),
    getMeta(META_KEYS.canonicalLastBackupAt(ownerId)),
    getMeta(META_KEYS.canonicalLastRestoreAt(ownerId)),
  ]);

  const mutableSync = [
    ...records.map(row => row.sync),
    ...clarifications.map(row => row.sync),
    ...media.map(row => row.sync),
  ];
  const appendOnlyPending = [
    ...history.map(row => row.at),
    ...people.map(row => row.created_at),
    ...organisations.map(row => row.created_at),
    ...relationships.map(row => row.created_at),
  ].filter(at => laterThan(at, lastBackupAt)).length;
  // Media with local-only storage is pending even if stale metadata incorrectly
  // claims a synced state. Count it once, not once for each condition.
  const pendingMutableIds = new Set<string>();
  records.forEach(row => { if (isPending(row.sync)) pendingMutableIds.add(`record:${row.id}`); });
  clarifications.forEach(row => { if (isPending(row.sync)) pendingMutableIds.add(`clarification:${row.id}`); });
  media.forEach(row => {
    if (isPending(row.sync) || row.storage.location === 'local') pendingMutableIds.add(`media:${row.id}`);
  });

  return {
    localCount: records.length,
    pendingCount: pendingMutableIds.size + appendOnlyPending,
    conflictCount: mutableSync.filter(isConflict).length,
    lastSyncAttemptAt: maxIso(mutableSync.map(sync => sync.last_attempt_at)),
    lastBackupAt,
    lastRestoreAt,
  };
}

export async function getCanonicalCloudDiagnostics(ownerId: string): Promise<{ cloudCount: number | null; cloudLastUpdatedAt: string | null }> {
  const countQuery = await supabase
    .from('canonical_records' as never)
    .select('id', { count: 'exact', head: true })
    .eq('owner_id' as never, ownerId as never);
  if (countQuery.error) return { cloudCount: null, cloudLastUpdatedAt: null };

  const latestQuery = await supabase
    .from('canonical_records' as never)
    .select('updated_at')
    .eq('owner_id' as never, ownerId as never)
    .order('updated_at' as never, { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestQuery.error) return { cloudCount: countQuery.count ?? 0, cloudLastUpdatedAt: null };
  const latest = latestQuery.data as unknown as { updated_at?: string | null } | null;
  return { cloudCount: countQuery.count ?? 0, cloudLastUpdatedAt: latest?.updated_at ?? null };
}
