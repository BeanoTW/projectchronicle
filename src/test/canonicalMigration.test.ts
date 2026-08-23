import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB, type LocalIncident } from '@/local/db';
import type { V1Snapshot } from '@/chronicle/model/migrationPlan';
import {
  applyCanonicalMigration,
  buildCanonicalMigration,
  CanonicalMigrationConflictError,
  CanonicalMigrationPreflightError,
} from '@/chronicle/model/canonicalMigration';

const at = (minute: number) => new Date(Date.parse('2026-08-20T10:00:00.000Z') + minute * 60_000).toISOString();

const incident = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  user_id: 'owner-1',
  raw_narrative: `  Original wording for ${id}.  `,
  record_type: 'incident',
  incident_date: '2026-08-20',
  record_date: null,
  incident_time: '09:30',
  category: 'Workplace',
  context_domain: 'employment',
  location: 'Office',
  title: `Title ${id}`,
  excluded_from_rep: false,
  people_involved: ['Alex Smith', 'alex smith'],
  witnesses: ['Alex Smith', 'Jamie Doe'],
  created_at: at(0),
  original_created_at: at(-2),
  updated_at: at(5),
  last_modified_at: at(5),
  version: 2,
  voided_at: null,
  void_reason: null,
  ...patch,
});

const snapshot = (): V1Snapshot => ({
  incidents: [
    incident('b', { incident_date: 'not-a-date', incident_time: 'morning-ish' }),
    incident('a'),
  ] as V1Snapshot['incidents'],
  notes: [
    { id: 'note-outcome', incident_id: 'a', note_text: 'Resolved.', note_type: 'Outcome', created_at: at(10) },
    { id: 'note-update', incident_id: 'a', note_text: 'Later update.', note_type: 'Update', created_at: at(11) },
  ],
  evidence: [
    {
      id: 'evidence-1', incident_id: 'a', file_name: 'photo.jpg', file_path: 'owner-1/photo.jpg',
      file_hash: 'sha256-test', mime_type: 'image/jpeg', upload_date: at(12), file_size: 321,
    } as V1Snapshot['evidence'][number],
    {
      id: 'evidence-no-size', incident_id: 'a', file_name: 'unknown.pdf', file_path: 'owner-1/unknown.pdf',
      file_hash: null, mime_type: 'application/pdf', upload_date: at(13),
    } as V1Snapshot['evidence'][number],
  ],
  history: [
    {
      id: 'history-1', incident_id: 'a', field_changed: 'category', changed_at: at(20), edit_source: 'user',
      old_value: 'Other', new_value: 'Workplace',
    } as V1Snapshot['history'][number],
  ],
});

const legacyLocalRow = {
  id: 'legacy-local', user_id: 'owner-1', owner_user_id: 'owner-1', raw_narrative: 'Legacy stays here.',
  record_type: 'incident', incident_date: '2026-08-20', record_date: null, incident_time: null,
  category: null, context_domain: null, location: null, title: null, excluded_from_rep: false,
  created_at: at(0), original_created_at: null, updated_at: at(0), last_modified_at: null,
  local_updated_at: at(0), sync_state: 'local_only', last_sync_attempt_at: null, last_sync_error: null,
  version: 1, voided_at: null, void_reason: null,
} as unknown as LocalIncident;

describe('Phase 4 — canonical migration', () => {
  let db: ChronicleDB;

  beforeEach(() => {
    db = new ChronicleDB(`chronicle_phase4_${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('builds deterministically without mutating V1 wording or inventing legacy precision', () => {
    const source = snapshot();
    const before = JSON.stringify(source);
    const first = buildCanonicalMigration(source);
    const second = buildCanonicalMigration(source);

    expect(second).toEqual(first);
    expect(JSON.stringify(source)).toBe(before);
    expect(first.records.map(record => record.id)).toEqual(['a', 'b']);
    expect(first.records[0].original.text).toBe('  Original wording for a.  ');
    expect(first.records[1].details.event_date).toBeNull();
    expect(first.records[1].details.event_time).toBeNull();
    expect(first.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: 'b', code: 'malformed_event_date' }),
      expect.objectContaining({ source_id: 'b', code: 'malformed_event_time' }),
      expect.objectContaining({ source_id: 'evidence-no-size', code: 'missing_media_size' }),
    ]));
  });

  it('migrates stable people and per-record roles without duplicating canonical records', () => {
    const build = buildCanonicalMigration(snapshot());
    const recordA = build.records.find(record => record.id === 'a')!;

    expect(build.people.map(person => person.normalised_name)).toEqual(['alex smith', 'jamie doe']);
    expect(recordA.details.person_ids).toHaveLength(2);
    expect(build.relationships.filter(row => row.record_id === 'a')).toEqual(expect.arrayContaining([
      expect.objectContaining({ role_note: 'involved; witness', source: 'migration' }),
      expect.objectContaining({ role_note: 'witness', source: 'migration' }),
    ]));
    expect(build.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: 'a', code: 'duplicate_person_name', severity: 'safe' }),
    ]));
  });

  it('keeps clarification kinds, evidence provenance and available history values honest', () => {
    const build = buildCanonicalMigration(snapshot());

    expect(build.clarifications.map(row => [row.id, row.kind])).toEqual([
      ['note-outcome', 'outcome'],
      ['note-update', 'follow_up'],
    ]);
    expect(build.media).toHaveLength(1);
    expect(build.media[0]).toMatchObject({
      id: 'evidence-1', role: 'legacy_unresolved', size: 321,
      storage: { location: 'remote_only', remote_path: 'owner-1/photo.jpg' },
    });
    expect(build.history[0]).toMatchObject({
      id: 'history-1', field: 'category', from_value: 'Other', to_value: 'Workplace', actor: 'user',
    });
  });

  it('writes atomically, leaves legacy stores untouched, and is idempotent on rerun', async () => {
    await db.incidents.add(legacyLocalRow);
    const build = buildCanonicalMigration(snapshot());
    const first = await applyCanonicalMigration(build, db);

    expect(first.written.records).toBe(2);
    expect(first.written.people).toBe(2);
    expect(first.written.relationships).toBe(4);
    expect(first.written.clarifications).toBe(2);
    expect(first.written.media).toBe(1);
    expect(first.written.history).toBe(1);

    expect((await db.incidents.get('legacy-local'))?.raw_narrative).toBe('Legacy stays here.');
    expect(await db.canonical_records.count()).toBe(2);

    const second = await applyCanonicalMigration(build, db);
    expect(second.written.records).toBe(0);
    expect(second.already_present.records).toBe(2);
    expect(second.already_present.people).toBe(2);
    expect(await db.canonical_records.count()).toBe(2);
  });

  it('aborts the entire write transaction on a conflicting canonical row', async () => {
    const build = buildCanonicalMigration(snapshot());
    const person = build.people[0];
    await db.canonical_people.add({ ...person, display_name: 'Different identity content' });

    await expect(applyCanonicalMigration(build, db)).rejects.toBeInstanceOf(CanonicalMigrationConflictError);

    // Records are written before people inside the transaction. A person conflict
    // must roll those earlier writes back rather than leave a partial migration.
    expect(await db.canonical_records.count()).toBe(0);
    expect(await db.canonical_people.count()).toBe(1);
  });

  it('refuses all writes when preflight contains a blocker', async () => {
    const source = snapshot();
    source.incidents = [incident('ownerless', { user_id: null })] as V1Snapshot['incidents'];
    source.notes = [];
    source.evidence = [];
    source.history = [];
    const build = buildCanonicalMigration(source);

    expect(build.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_owner', severity: 'blocker' }),
    ]));
    await expect(applyCanonicalMigration(build, db)).rejects.toBeInstanceOf(CanonicalMigrationPreflightError);
    expect(await db.canonical_records.count()).toBe(0);
  });
});
