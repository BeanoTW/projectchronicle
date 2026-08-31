// Phase 4 — deterministic V1 -> canonical projection and non-destructive write.
//
// The builder is pure. The executor writes only to parallel canonical stores.
// Legacy incidents/notes/evidence/history are never updated or deleted here.
import type { Table } from 'dexie';
import { V2MediaSchema, V2RecordRelationshipSchema, V2RecordSchema } from './contracts';
import type { V1Snapshot } from './migrationPlan';
import {
  V2_SCHEMA_VERSION,
  type V2Clarification,
  type V2Media,
  type V2Person,
  type V2Record,
  type V2RecordEvent,
  type V2RecordRelationship,
} from './schema';
import { ChronicleDB, localDB } from '@/local/db';

export type CanonicalMigrationIssueSeverity = 'safe' | 'requires_handling' | 'blocker';
export type CanonicalMigrationIssueCode =
  | 'missing_owner'
  | 'invalid_created_at'
  | 'invalid_original_created_at'
  | 'invalid_voided_at'
  | 'malformed_event_date'
  | 'malformed_event_time'
  | 'duplicate_person_name'
  | 'orphan_note'
  | 'invalid_note_timestamp'
  | 'orphan_media'
  | 'invalid_media_timestamp'
  | 'missing_media_size'
  | 'orphan_history'
  | 'invalid_history_timestamp';

export interface CanonicalMigrationIssue {
  source: 'incident' | 'note' | 'evidence' | 'history';
  source_id: string;
  record_id: string | null;
  code: CanonicalMigrationIssueCode;
  severity: CanonicalMigrationIssueSeverity;
  detail: string;
}

export interface CanonicalMigrationBuild {
  records: readonly V2Record[];
  clarifications: readonly V2Clarification[];
  media: readonly V2Media[];
  history: readonly V2RecordEvent[];
  people: readonly V2Person[];
  relationships: readonly V2RecordRelationship[];
  issues: readonly CanonicalMigrationIssue[];
  inspected: {
    incidents: number;
    notes: number;
    evidence: number;
    history: number;
  };
}

export interface CanonicalMigrationWriteReport {
  written: {
    records: number;
    clarifications: number;
    media: number;
    history: number;
    people: number;
    relationships: number;
  };
  already_present: CanonicalMigrationWriteReport['written'];
}

export class CanonicalMigrationPreflightError extends Error {
  constructor(public readonly issues: readonly CanonicalMigrationIssue[]) {
    super(`Canonical migration has ${issues.length} blocking issue(s).`);
  }
}

export class CanonicalMigrationConflictError extends Error {
  constructor(public readonly tableName: string, public readonly rowId: string) {
    super(`Canonical migration conflict in ${tableName} for ${rowId}.`);
  }
}

const iso = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const validTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const ownerOf = (row: Record<string, unknown>): string | null => {
  const value = row.owner_user_id ?? row.user_id;
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const normaliseName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const stablePersonId = (ownerId: string, normalised: string): string =>
  `legacy-person:${encodeURIComponent(ownerId)}:${encodeURIComponent(normalised)}`;
const stableRelationshipId = (recordId: string, personId: string): string =>
  `legacy-relationship:${encodeURIComponent(recordId)}:${encodeURIComponent(personId)}`;

const childSync = () => ({
  remote_version: null,
  local_revision: 0,
  state: { state: 'local_only' as const },
  last_attempt_at: null,
});

const clarificationKind = (value: string | null): V2Clarification['kind'] => {
  const key = (value ?? '').trim().toLocaleLowerCase().replace(/[ -]+/g, '_');
  if (key === 'outcome') return 'outcome';
  if (key === 'correction') return 'correction';
  if (key === 'follow_up' || key === 'update' || key === 'meeting') return 'follow_up';
  return 'clarification';
};

const mediaKind = (mime: string | null): V2Media['kind'] => {
  const value = (mime ?? '').toLocaleLowerCase();
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  if (value.startsWith('audio/')) return 'audio';
  if (value === 'application/pdf' || value.startsWith('text/')) return 'document';
  return 'other';
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Pure deterministic projection. The source snapshot is never mutated. */
export const buildCanonicalMigration = (snapshot: V1Snapshot): CanonicalMigrationBuild => {
  const records: V2Record[] = [];
  const clarifications: V2Clarification[] = [];
  const media: V2Media[] = [];
  const history: V2RecordEvent[] = [];
  const people = new Map<string, V2Person>();
  const relationships: V2RecordRelationship[] = [];
  const issues: CanonicalMigrationIssue[] = [];
  const recordById = new Map<string, V2Record>();

  const incidents = [...snapshot.incidents].sort((a, b) => a.id.localeCompare(b.id));

  for (const row of incidents) {
    const raw = row as Record<string, unknown>;
    const ownerId = ownerOf(raw);
    if (!ownerId) {
      issues.push({ source: 'incident', source_id: row.id, record_id: row.id, code: 'missing_owner', severity: 'blocker', detail: 'No owner id is available.' });
      continue;
    }

    const sealedAt = iso(row.created_at);
    if (!sealedAt) {
      issues.push({ source: 'incident', source_id: row.id, record_id: row.id, code: 'invalid_created_at', severity: 'blocker', detail: 'created_at is missing or invalid.' });
      continue;
    }

    const rawVoidedAt = raw.voided_at;
    const voidedAt = iso(rawVoidedAt);
    if (rawVoidedAt && !voidedAt) {
      issues.push({ source: 'incident', source_id: row.id, record_id: row.id, code: 'invalid_voided_at', severity: 'blocker', detail: 'Voided state exists but voided_at is invalid.' });
      continue;
    }

    const rawCaptured = raw.original_created_at;
    const parsedCaptured = iso(rawCaptured);
    if (rawCaptured && !parsedCaptured) {
      issues.push({ source: 'incident', source_id: row.id, record_id: row.id, code: 'invalid_original_created_at', severity: 'safe', detail: 'Invalid original_created_at; falling back to created_at as defined by the migration contract.' });
    }
    const capturedAt = parsedCaptured ?? sealedAt;
    const updatedAt = iso(raw.updated_at) ?? iso(raw.last_modified_at) ?? sealedAt;

    const daily = row.record_type === 'daily' || row.record_type === 'daily_record';
    const rawEventDate = daily ? (row.record_date ?? row.incident_date) : row.incident_date;
    const eventDate = validDate(rawEventDate) ? { kind: 'exact' as const, date: rawEventDate } : null;
    if (rawEventDate && !eventDate) {
      issues.push({ source: 'incident', source_id: row.id, record_id: row.id, code: 'malformed_event_date', severity: 'requires_handling', detail: `Event date "${String(rawEventDate)}" is not an exact calendar date and was left unset.` });
    }

    const eventTime = validTime(row.incident_time) ? row.incident_time : null;
    if (row.incident_time && !eventTime) {
      issues.push({ source: 'incident', source_id: row.id, record_id: row.id, code: 'malformed_event_time', severity: 'requires_handling', detail: `Event time "${row.incident_time}" is not HH:MM and was left unset.` });
    }

    const roleByPerson = new Map<string, { display: string; involved: boolean; witness: boolean }>();
    const addNames = (values: string[] | null | undefined, role: 'involved' | 'witness') => {
      for (const value of values ?? []) {
        const display = value.trim().replace(/\s+/g, ' ');
        if (!display) continue;
        const key = normaliseName(display);
        const existing = roleByPerson.get(key);
        if (existing) {
          if (role === 'involved' ? existing.involved : existing.witness) {
            issues.push({ source: 'incident', source_id: row.id, record_id: row.id, code: 'duplicate_person_name', severity: 'safe', detail: `Duplicate legacy person name "${display}" was merged within this record.` });
          }
          existing[role] = true;
        } else {
          roleByPerson.set(key, { display, involved: role === 'involved', witness: role === 'witness' });
        }
      }
    };
    addNames(row.people_involved, 'involved');
    addNames(row.witnesses, 'witness');

    const personIds: string[] = [];
    for (const [normalised, role] of [...roleByPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const personId = stablePersonId(ownerId, normalised);
      personIds.push(personId);
      if (!people.has(personId)) {
        people.set(personId, {
          id: personId,
          owner_id: ownerId,
          display_name: role.display,
          normalised_name: normalised,
          role_note: null,
          created_at: sealedAt,
          merged_into_id: null,
        });
      }
      const roleNote = role.involved && role.witness ? 'involved; witness' : role.witness ? 'witness' : 'involved';
      relationships.push({
        id: stableRelationshipId(row.id, personId),
        owner_id: ownerId,
        record_id: row.id,
        entity_type: 'person',
        entity_id: personId,
        role_note: roleNote,
        source: 'migration',
        created_at: sealedAt,
        removed_at: null,
      });
    }

    const record: V2Record = V2RecordSchema.parse({
      id: row.id,
      owner_id: ownerId,
      kind: daily ? 'daily' : 'incident',
      schema_version: V2_SCHEMA_VERSION,
      original: {
        text: row.raw_narrative ?? '',
        source: 'imported_v1',
        media_ids: [],
        sealed_at: sealedAt,
      },
      details: {
        title: typeof raw.title === 'string' ? raw.title : null,
        category_id: typeof row.category === 'string' ? row.category : null,
        context: typeof raw.context_domain === 'string' ? raw.context_domain : null,
        person_ids: personIds,
        location: typeof raw.location === 'string' ? raw.location : null,
        event_date: eventDate,
        event_time: eventTime,
        revision_count: Math.max(0, typeof raw.version === 'number' ? raw.version - 1 : 0),
      },
      lifecycle: voidedAt
        ? { state: 'archived', archived_at: voidedAt, reason: typeof raw.void_reason === 'string' ? raw.void_reason : undefined }
        : { state: 'sealed' },
      dossier: row.excluded_from_rep
        ? { state: 'excluded', excluded_at: updatedAt, reason: 'Legacy exclusion state' }
        : { state: 'not_included' },
      captured_at: capturedAt,
      sealed_at: sealedAt,
      created_at: sealedAt,
      updated_at: updatedAt,
      sync: childSync(),
    });

    records.push(record);
    recordById.set(record.id, record);
  }

  for (const note of [...snapshot.notes].sort((a, b) => a.id.localeCompare(b.id))) {
    const parent = recordById.get(note.incident_id);
    if (!parent) {
      issues.push({ source: 'note', source_id: note.id, record_id: note.incident_id, code: 'orphan_note', severity: 'requires_handling', detail: 'Note has no migrated parent record; legacy row remains untouched.' });
      continue;
    }
    const createdAt = iso(note.created_at);
    if (!createdAt) {
      issues.push({ source: 'note', source_id: note.id, record_id: note.incident_id, code: 'invalid_note_timestamp', severity: 'requires_handling', detail: 'Note timestamp is invalid; legacy row remains untouched.' });
      continue;
    }
    clarifications.push({
      id: note.id,
      record_id: parent.id,
      owner_id: parent.owner_id,
      kind: clarificationKind(note.note_type),
      text: note.note_text,
      created_at: createdAt,
      sync: childSync(),
    });
  }

  for (const evidence of [...snapshot.evidence].sort((a, b) => a.id.localeCompare(b.id))) {
    const parent = evidence.incident_id ? recordById.get(evidence.incident_id) : undefined;
    if (!parent) {
      issues.push({ source: 'evidence', source_id: evidence.id, record_id: evidence.incident_id, code: 'orphan_media', severity: 'requires_handling', detail: 'Evidence has no migrated parent record; its legacy reference remains untouched.' });
      continue;
    }
    const addedAt = iso(evidence.upload_date);
    if (!addedAt) {
      issues.push({ source: 'evidence', source_id: evidence.id, record_id: parent.id, code: 'invalid_media_timestamp', severity: 'requires_handling', detail: 'Evidence upload timestamp is invalid; legacy reference remains untouched.' });
      continue;
    }
    const rawEvidence = evidence as unknown as Record<string, unknown>;
    const size = rawEvidence.file_size;
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
      issues.push({ source: 'evidence', source_id: evidence.id, record_id: parent.id, code: 'missing_media_size', severity: 'requires_handling', detail: 'Evidence size is unavailable; legacy reference remains untouched rather than inventing a byte size.' });
      continue;
    }

    media.push(V2MediaSchema.parse({
      id: evidence.id,
      record_id: parent.id,
      owner_id: parent.owner_id,
      kind: mediaKind(evidence.mime_type),
      role: 'legacy_unresolved',
      name: evidence.file_name,
      mime: evidence.mime_type ?? 'application/octet-stream',
      size,
      duration_ms: null,
      description: typeof rawEvidence.description === 'string' ? rawEvidence.description : null,
      added_at: addedAt,
      inclusion: { state: 'included' },
      storage: { location: 'remote_only', remote_path: evidence.file_path },
      content_hash: evidence.file_hash,
      sync: childSync(),
    }));
  }

  for (const item of [...snapshot.history].sort((a, b) => a.id.localeCompare(b.id))) {
    const parent = recordById.get(item.incident_id);
    if (!parent) {
      issues.push({ source: 'history', source_id: item.id, record_id: item.incident_id, code: 'orphan_history', severity: 'safe', detail: 'History has no migrated parent record; legacy row remains untouched.' });
      continue;
    }
    const at = iso(item.changed_at);
    if (!at) {
      issues.push({ source: 'history', source_id: item.id, record_id: parent.id, code: 'invalid_history_timestamp', severity: 'requires_handling', detail: 'History timestamp is invalid; legacy row remains untouched.' });
      continue;
    }
    const rawHistory = item as unknown as Record<string, unknown>;
    history.push({
      id: item.id,
      record_id: parent.id,
      owner_id: parent.owner_id,
      at,
      action: 'details_updated',
      field: item.field_changed || null,
      from_value: typeof rawHistory.old_value === 'string' ? rawHistory.old_value : null,
      to_value: typeof rawHistory.new_value === 'string' ? rawHistory.new_value : null,
      actor: item.edit_source === 'user' ? 'user' : item.edit_source === 'system' ? 'system' : 'migration',
    });
  }

  const sortedRelationships = relationships
    .map(value => V2RecordRelationshipSchema.parse(value))
    .sort((a, b) => a.id.localeCompare(b.id));

  issues.sort((a, b) => `${a.source}:${a.source_id}:${a.code}`.localeCompare(`${b.source}:${b.source_id}:${b.code}`));

  return {
    records: records.sort((a, b) => a.id.localeCompare(b.id)),
    clarifications: clarifications.sort((a, b) => a.id.localeCompare(b.id)),
    media: media.sort((a, b) => a.id.localeCompare(b.id)),
    history: history.sort((a, b) => a.id.localeCompare(b.id)),
    people: [...people.values()].sort((a, b) => a.id.localeCompare(b.id)),
    relationships: sortedRelationships,
    issues,
    inspected: {
      incidents: snapshot.incidents.length,
      notes: snapshot.notes.length,
      evidence: snapshot.evidence.length,
      history: snapshot.history.length,
    },
  };
};

const writeRows = async <T extends { id: string }>(
  tableName: string,
  table: Table<T, string>,
  rows: readonly T[],
): Promise<{ written: number; already: number }> => {
  let written = 0;
  let already = 0;
  for (const row of rows) {
    const existing = await table.get(row.id);
    if (existing) {
      if (!same(existing, row)) throw new CanonicalMigrationConflictError(tableName, row.id);
      already += 1;
      continue;
    }
    await table.add(structuredClone(row));
    written += 1;
  }
  return { written, already };
};

/**
 * Atomically writes a preflighted canonical build. Any conflicting existing
 * canonical row aborts the transaction; V1 stores are not part of the write.
 */
export const applyCanonicalMigration = async (
  build: CanonicalMigrationBuild,
  db: ChronicleDB = localDB,
): Promise<CanonicalMigrationWriteReport> => {
  const blockers = build.issues.filter(issue => issue.severity === 'blocker');
  if (blockers.length > 0) throw new CanonicalMigrationPreflightError(blockers);

  return db.transaction(
    'rw',
    [
      db.canonical_records,
      db.canonical_clarifications,
      db.canonical_media,
      db.canonical_history,
      db.canonical_people,
      db.canonical_relationships,
    ],
    async () => {
      const recordResult = await writeRows('canonical_records', db.canonical_records, build.records);
      const clarificationResult = await writeRows('canonical_clarifications', db.canonical_clarifications, build.clarifications);
      const mediaResult = await writeRows('canonical_media', db.canonical_media, build.media);
      const historyResult = await writeRows('canonical_history', db.canonical_history, build.history);
      const peopleResult = await writeRows('canonical_people', db.canonical_people, build.people);
      const relationshipResult = await writeRows('canonical_relationships', db.canonical_relationships, build.relationships);

      return {
        written: {
          records: recordResult.written,
          clarifications: clarificationResult.written,
          media: mediaResult.written,
          history: historyResult.written,
          people: peopleResult.written,
          relationships: relationshipResult.written,
        },
        already_present: {
          records: recordResult.already,
          clarifications: clarificationResult.already,
          media: mediaResult.already,
          history: historyResult.already,
          people: peopleResult.already,
          relationships: relationshipResult.already,
        },
      };
    },
  );
};
