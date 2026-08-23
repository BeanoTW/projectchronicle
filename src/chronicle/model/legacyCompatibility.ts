// Phase 2 — read-only compatibility projection from the existing local V1 row
// into the canonical V2 contract. This module does not write, migrate or alter
// IndexedDB. It exists so new architecture can consume old records safely.
import { V2RecordSchema } from './contracts';
import { V2_SCHEMA_VERSION, type EventDateValue, type SyncMetadata, type V2Record } from './schema';
import type { LocalIncident } from '@/local/db';

const validDate = (value: string | null | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const validTime = (value: string | null | undefined): value is string =>
  !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const toIso = (value: string | null | undefined, fallback: string): string => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const eventDate = (row: LocalIncident): EventDateValue | null => {
  const raw = row.record_type === 'daily' || row.record_type === 'daily_record'
    ? (row.record_date ?? row.incident_date)
    : row.incident_date;
  return validDate(raw) ? { kind: 'exact', date: raw } : null;
};

const sync = (row: LocalIncident): SyncMetadata => {
  const lastAttempt = row.last_sync_attempt_at ? toIso(row.last_sync_attempt_at, row.local_updated_at) : null;
  const remoteVersion = row.cloud_version ?? row.version ?? null;
  switch (row.sync_state) {
    case 'queued':
      return { remote_version: remoteVersion, local_revision: row.version ?? 0, state: { state: 'queued', since: lastAttempt ?? toIso(row.local_updated_at, row.created_at) }, last_attempt_at: lastAttempt };
    case 'backed_up':
      return { remote_version: remoteVersion, local_revision: row.version ?? 0, state: { state: 'synced', at: lastAttempt ?? toIso(row.updated_at, row.created_at), remote_version: remoteVersion ?? 0 }, last_attempt_at: lastAttempt };
    case 'backup_failed':
      return { remote_version: remoteVersion, local_revision: row.version ?? 0, state: { state: 'failed', at: lastAttempt ?? toIso(row.local_updated_at, row.created_at), attempts: 1, message: row.last_sync_error ?? 'Legacy backup failed.' }, last_attempt_at: lastAttempt };
    case 'conflict':
      return { remote_version: remoteVersion, local_revision: row.version ?? 0, state: { state: 'conflict', detected_at: toIso(row.conflict_detected_at, row.local_updated_at), remote_version: remoteVersion ?? 0 }, last_attempt_at: lastAttempt };
    default:
      return { remote_version: remoteVersion, local_revision: row.version ?? 0, state: { state: 'local_only' }, last_attempt_at: lastAttempt };
  }
};

/**
 * Projects one existing local record into the canonical contract without
 * mutating the source. Unknown/invalid legacy precision is left null rather
 * than guessed. Legacy people remain unlinked until identity migration.
 */
export const projectLegacyIncident = (row: LocalIncident): V2Record => {
  const sealedAt = toIso(row.created_at, new Date(0).toISOString());
  const capturedAt = toIso(row.original_created_at, sealedAt);
  const updatedAt = toIso(row.updated_at ?? row.last_modified_at ?? row.local_updated_at, sealedAt);
  const lifecycle = row.voided_at
    ? { state: 'archived' as const, archived_at: toIso(row.voided_at, updatedAt), reason: row.void_reason ?? undefined }
    : { state: 'sealed' as const };

  const projected: V2Record = {
    id: row.id,
    owner_id: row.owner_user_id,
    kind: row.record_type === 'daily' || row.record_type === 'daily_record' ? 'daily' : 'incident',
    schema_version: V2_SCHEMA_VERSION,
    original: {
      text: row.raw_narrative ?? '',
      source: 'imported_v1',
      media_ids: [],
      sealed_at: sealedAt,
    },
    details: {
      title: row.title ?? null,
      category_id: row.category ?? null,
      context: row.context_domain ?? null,
      person_ids: [],
      location: row.location ?? null,
      event_date: eventDate(row),
      event_time: validTime(row.incident_time) ? row.incident_time : null,
      revision_count: Math.max(0, (row.version ?? 1) - 1),
    },
    lifecycle,
    dossier: row.excluded_from_rep
      ? { state: 'excluded', excluded_at: updatedAt, reason: 'Legacy exclusion state' }
      : { state: 'not_included' },
    captured_at: capturedAt,
    sealed_at: sealedAt,
    created_at: sealedAt,
    updated_at: updatedAt,
    sync: sync(row),
  };

  return V2RecordSchema.parse(projected);
};

/** Owner-scoped, deterministic projection used by compatibility readers. */
export const projectLegacyIncidents = (rows: readonly LocalIncident[], ownerId: string): readonly V2Record[] =>
  rows
    .filter(row => row.owner_user_id === ownerId)
    .map(projectLegacyIncident)
    .sort((a, b) => a.id.localeCompare(b.id));
