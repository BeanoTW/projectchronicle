import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB, type LocalFollowUpNote, type LocalIncident } from '@/local/db';
import {
  loadProductionV1Snapshot,
  migrateProductionOwnerToCanonical,
  ProductionCanonicalMigrationError,
  type ProductionLegacySourceAdapter,
} from '@/chronicle/model/productionCanonicalMigration';
import { getCanonicalActivation } from '@/chronicle/model/canonicalActivation';

const owner = 'owner-1';
const at = '2026-08-26T04:30:00.000Z';
const incident = (id: string): LocalIncident => ({
  id,
  user_id: owner,
  owner_user_id: owner,
  raw_narrative: `Exact wording ${id}`,
  record_type: 'incident',
  incident_date: '2026-08-26',
  record_date: null,
  incident_time: '04:30',
  category: null,
  created_at: at,
  original_created_at: at,
  updated_at: at,
  excluded_from_rep: false,
  people_involved: [],
  witnesses: [],
  version: 1,
  cloud_version: null,
  sync_state: 'local_only',
  last_sync_attempt_at: null,
  last_sync_error: null,
  local_updated_at: at,
} as unknown as LocalIncident);
const note = (id: string, recordId: string): LocalFollowUpNote => ({
  id,
  user_id: owner,
  owner_user_id: owner,
  incident_id: recordId,
  note_text: 'Follow-up',
  note_type: 'Update',
  created_at: at,
  sync_state: 'local_only',
  last_sync_attempt_at: null,
  last_sync_error: null,
  local_updated_at: at,
} as LocalFollowUpNote);

const source = (
  incidentIds: string[],
  notes: LocalFollowUpNote[] = [],
  versions: Record<string, number> = {},
): ProductionLegacySourceAdapter => ({
  async loadCloudSources() {
    return {
      evidence: [],
      history: [],
      cloudIncidents: incidentIds.map(id => ({ id, version: versions[id] ?? 1, updated_at: at })),
      cloudNotes: notes.map(row => ({ id: row.id, incident_id: row.incident_id, note_text: row.note_text, note_type: row.note_type, created_at: row.created_at })),
    };
  },
});

describe('production canonical migration', () => {
  let db: ChronicleDB;
  beforeEach(() => { db = new ChronicleDB(`chronicle_production_migration_${crypto.randomUUID()}`); });
  afterEach(async () => { db.close(); await db.delete(); });

  it('uses local-first incidents/notes so unsynced work is included without leaking sync bookkeeping', async () => {
    await db.incidents.add(incident('local-only'));
    await db.follow_up_notes.add(note('note-local', 'local-only'));

    const loaded = await loadProductionV1Snapshot(owner, db, source([], []));
    expect(loaded.snapshot.incidents.map(row => row.id)).toEqual(['local-only']);
    expect(loaded.snapshot.notes.map(row => row.id)).toEqual(['note-local']);
    const raw = loaded.snapshot.incidents[0] as Record<string, unknown>;
    expect(raw.owner_user_id).toBeUndefined();
    expect(raw.sync_state).toBeUndefined();
    expect(raw.local_updated_at).toBeUndefined();
    expect(raw.cloud_version).toBeUndefined();
  });

  it('blocks cutover when the cloud knows about a legacy row missing from this device', async () => {
    await db.incidents.add(incident('local-present'));
    await expect(loadProductionV1Snapshot(owner, db, source(['local-present', 'cloud-missing'])))
      .rejects.toMatchObject({ code: 'local_source_incomplete' });
    expect(await getCanonicalActivation(owner, db)).toBeNull();
  });

  it('blocks rather than choosing a winner for a known or cloud-newer incident', async () => {
    const conflicted = incident('conflict');
    conflicted.sync_state = 'conflict';
    conflicted.cloud_version = 2;
    await db.incidents.add(conflicted);
    await expect(loadProductionV1Snapshot(owner, db, source(['conflict'], [], { conflict: 2 })))
      .rejects.toMatchObject({ code: 'source_conflict' });

    await db.incidents.clear();
    const stale = incident('stale');
    stale.cloud_version = 1;
    await db.incidents.add(stale);
    await expect(loadProductionV1Snapshot(owner, db, source(['stale'], [], { stale: 2 })))
      .rejects.toMatchObject({ code: 'source_conflict' });
  });

  it('blocks a same-id follow-up note whose cloud content differs', async () => {
    await db.incidents.add(incident('record-1'));
    const localNote = note('note-1', 'record-1');
    await db.follow_up_notes.add(localNote);
    const remoteNote = { ...localNote, note_text: 'Different cloud wording' };
    await expect(loadProductionV1Snapshot(owner, db, source(['record-1'], [remoteNote])))
      .rejects.toMatchObject({ code: 'source_conflict' });
  });

  it('does not activate when deterministic source validation requires handling', async () => {
    const bad = incident('bad-time');
    bad.incident_time = 'after lunch';
    await db.incidents.add(bad);

    await expect(migrateProductionOwnerToCanonical(owner, { db, source: source(['bad-time']) }))
      .rejects.toBeInstanceOf(ProductionCanonicalMigrationError);
    expect(await getCanonicalActivation(owner, db)).toBeNull();
  });

  it('writes and activates a clean explicitly selected owner without deleting legacy rows', async () => {
    await db.incidents.add(incident('record-1'));
    const localNote = note('note-1', 'record-1');
    await db.follow_up_notes.add(localNote);

    const report = await migrateProductionOwnerToCanonical(owner, {
      db,
      source: source(['record-1'], [localNote]),
      clock: () => at,
    });

    expect(report.source).toEqual({ localIncidents: 1, localNotes: 1, cloudEvidence: 0, cloudHistory: 0 });
    expect(report.activation.owner_id).toBe(owner);
    expect(await getCanonicalActivation(owner, db)).not.toBeNull();
    expect(await db.canonical_records.where('owner_id').equals(owner).count()).toBe(1);
    expect(await db.incidents.where('owner_user_id').equals(owner).count()).toBe(1);
    expect(await db.follow_up_notes.where('owner_user_id').equals(owner).count()).toBe(1);
  });
});
