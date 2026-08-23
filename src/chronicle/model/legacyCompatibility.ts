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

const normaliseIso = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const requireIso = (value: string | null | undefined, field: string): string => {
  const parsed = normaliseIso(value);
  if (!parsed) throw new Error(`Legacy record has no valid ${field}; canonical projection refused.`);
  return parsed;
};

const eventDate = (row: LocalIncident): EventDateValue | null => {
  const raw = row.record_type === 'daily' || row.record_type === 'daily_record'
    ? (row.record_date ?? row.incident_date)
    : row.incident_date;
  return validDate(raw) ? { kind: 'exact', date: raw } : null;
};

const sync = (row: LocalIncident, sealedAt: string, updatedAt: string): SyncMetadata => {
  const lastAttempt = normaliseIso(row.last_sync_attempt_at);
  const remoteVersion = row.cloud_version ?? row.version ?? null;
  const localRevision = Math.max(0, row.version ?? 0);
  switch (row.sync_state) {
    case 'queued':
      return { remote_version: remoteVersion, local_revision: localRevision, state: { state: 'queued', since: lastAttempt ?? updatedAt }, last_attempt_at: lastAttempt };
    case 'backed_up':
      return { remote_version: remoteVersion, local_revision: localRevision, state: { state: 'synced', at: lastAttempt ?? updatedAt, remote_version: remoteVersion ?? 0 }, last_attempt_at: lastAttempt };
    case 'backup_failed':
      return { remote_version: remoteVersion, local_revision: localRevision, state: { state: 'failed', at: lastAttempt ?? updatedAt, attempts: 1, message: row.last_sync_error ?? 'Legacy backup failed.' }, last_attempt_at: lastAttempt };
    case 'conflict':
      return { remote_version: remoteVersion, local_revision: localRevision, state: { state: 'conflict', detected_at: normaliseIso(row.conflict_detected_at) ?? updatedAt, remote_version: remoteVersion ?? 0 }, last_attempt_at: lastAttempt };
    default:
      return { remote_version: remoteVersion, local_revision: localRevision, state: { state: 'local_only' }, last_attempt_at: lastAttempt };
  }
};

/**
 * Projects one existing local record into the canonical contract without
 * mutating the source. Unknown/invalid event precision is left null rather
 * than guessed. Required provenance timestamps are rejected if corrupt: the
 * compatibility layer never fabricates a date simply to satisfy the schema.
 * Legacy people remain unlinked until identity migration.
 */
export const projectLegacyIncident = (row: LocalIncident): V2Record => {
  const sealedAt = requireIso(row.created_at, 'created_at');
  const capturedAt = normaliseIso(row.original_created_at) ?? sealedAt;
  const updatedAt = normaliseIso(row.updated_at) ?? normaliseIso(row.local_updated_at) ?? sealedAt;
  const archivedAt = normaliseIso(row.voided_at);
  const lifecycle = archivedAt
    ? { state: 'archived' as const, archived_at: archivedAt, reason: row.void_reason ?? undefined }
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
    sync: sync(row, sealedAt, updatedAt),
  };

  return V2RecordSchema.parse(projected);
};

/** Owner-scoped, deterministic projection used by compatibility readers. */
export const projectLegacyIncidents = (rows: readonly LocalIncident[], ownerId: string): readonly V2Record[] =>
  rows
    .filter(row => row.owner_user_id === ownerId)
    .map(projectLegacyIncident)
    .sort((a, b) => a.id.localeCompare(b.id));
