import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB, CanonicalStorageBoundaryError, META_KEYS, type LocalIncident } from '@/local/db';
import { applyCanonicalMigration, buildCanonicalMigration } from '@/chronicle/model/canonicalMigration';
import type { V1Snapshot } from '@/chronicle/model/migrationPlan';
import {
  clearConfirmedLocalAccountErasure,
  getConfirmedLocalAccountErasure,
  markConfirmedLocalAccountErasure,
  recoverConfirmedLocalAccountErasure,
} from '@/chronicle/shared/accountErasure';

const A = 'owner-a';
const B = 'owner-b';
const at = '2026-08-25T12:00:00.000Z';

const legacyIncident = (id: string, owner: string): V1Snapshot['incidents'][number] => ({
  id, user_id: owner, raw_narrative: `Original ${id}`, record_type: 'incident',
  incident_date: '2026-08-25', record_date: null, incident_time: '12:00', category: null,
  created_at: at, original_created_at: at, excluded_from_rep: false,
  people_involved: [`Person ${owner}`], witnesses: [],
} as V1Snapshot['incidents'][number]);

const localIncident = (id: string, owner: string) => ({
  id, user_id: owner, owner_user_id: owner, raw_narrative: `Local ${id}`,
  incident_date: '2026-08-25', created_at: at, updated_at: at, local_updated_at: at,
  sync_state: 'local_only', last_sync_attempt_at: null, last_sync_error: null,
  people_involved: [], witnesses: [], tags: [], status: 'Open', locked: false,
  excluded_from_rep: false, record_type: 'incident', version: 1,
} as unknown as LocalIncident);

const migration = (): V1Snapshot => ({
  incidents: [legacyIncident('canonical-a', A), legacyIncident('canonical-b', B)],
  notes: [
    { id: 'note-a', incident_id: 'canonical-a', note_text: 'A note', note_type: 'Update', created_at: at },
    { id: 'note-b', incident_id: 'canonical-b', note_text: 'B note', note_type: 'Update', created_at: at },
  ],
  evidence: [],
  history: [],
});

describe('confirmed account erasure', () => {
  let db: ChronicleDB;

  beforeEach(async () => {
    localStorage.clear();
    db = new ChronicleDB(`chronicle_account_erasure_${crypto.randomUUID()}`);
    await applyCanonicalMigration(buildCanonicalMigration(migration()), db);
    await db.incidents.bulkAdd([localIncident('legacy-a', A), localIncident('legacy-b', B)]);
    await db.quarantine.bulkAdd([
      { key: 'q-a', owner_user_id: A, kind: 'incident', stored_at: at, payload: localIncident('q-payload-a', A) },
      { key: 'q-b', owner_user_id: B, kind: 'incident', stored_at: at, payload: localIncident('q-payload-b', B) },
    ]);
    await db.meta.bulkPut([
      { key: `canonical_activation:${A}`, value: '{}' },
      { key: `canonical_capture_enabled:${A}`, value: '{}' },
      { key: META_KEYS.canonicalLastBackupAt(A), value: at },
      { key: META_KEYS.canonicalLastRestoreAt(A), value: at },
      { key: `canonical_activation:${B}`, value: '{}' },
      { key: META_KEYS.canonicalLastBackupAt(B), value: at },
      { key: 'backup_enabled', value: '1' },
    ]);
  });

  afterEach(async () => {
    clearConfirmedLocalAccountErasure();
    db.close();
    await db.delete();
  });

  it('keeps normal sealed-record deletion blocked', async () => {
    await expect(db.canonical_records.delete('canonical-a')).rejects.toBeInstanceOf(CanonicalStorageBoundaryError);
    expect(await db.canonical_records.get('canonical-a')).toBeDefined();
  });

  it('erases only the confirmed owner across legacy, canonical, blob/child and owner-meta stores', async () => {
    const report = await db.eraseOwnerData(A);
    expect(report.legacy_records).toBe(1);
    expect(report.canonical_records).toBe(1);
    expect(report.canonical_clarifications).toBe(1);
    expect(report.quarantined_rows).toBe(1);
    expect(report.meta_rows).toBe(4);

    expect(await db.incidents.where('owner_user_id').equals(A).count()).toBe(0);
    expect(await db.canonical_records.where('owner_id').equals(A).count()).toBe(0);
    expect(await db.canonical_clarifications.where('owner_id').equals(A).count()).toBe(0);
    expect(await db.canonical_people.where('owner_id').equals(A).count()).toBe(0);
    expect(await db.canonical_relationships.where('owner_id').equals(A).count()).toBe(0);
    expect(await db.quarantine.where('owner_user_id').equals(A).count()).toBe(0);
    expect(await db.meta.get(`canonical_activation:${A}`)).toBeUndefined();
    expect(await db.meta.get(`canonical_capture_enabled:${A}`)).toBeUndefined();
    expect(await db.meta.get(META_KEYS.canonicalLastBackupAt(A))).toBeUndefined();
    expect(await db.meta.get(META_KEYS.canonicalLastRestoreAt(A))).toBeUndefined();

    expect(await db.incidents.where('owner_user_id').equals(B).count()).toBe(1);
    expect(await db.canonical_records.where('owner_id').equals(B).count()).toBe(1);
    expect(await db.canonical_clarifications.where('owner_id').equals(B).count()).toBe(1);
    expect(await db.canonical_people.where('owner_id').equals(B).count()).toBeGreaterThan(0);
    expect(await db.quarantine.where('owner_user_id').equals(B).count()).toBe(1);
    expect(await db.meta.get(`canonical_activation:${B}`)).toBeDefined();
    expect(await db.meta.get(META_KEYS.canonicalLastBackupAt(B))).toBeDefined();
    expect(await db.meta.get('backup_enabled')).toEqual({ key: 'backup_enabled', value: '1' });
  });

  it('persists a server-confirmed recovery marker until local erasure commits', async () => {
    markConfirmedLocalAccountErasure(A);
    expect(getConfirmedLocalAccountErasure()).toMatchObject({ owner_id: A });

    expect(await recoverConfirmedLocalAccountErasure(db)).toBe(true);
    expect(getConfirmedLocalAccountErasure()).toBeNull();
    expect(await db.canonical_records.where('owner_id').equals(A).count()).toBe(0);
    expect(await db.canonical_records.where('owner_id').equals(B).count()).toBe(1);
  });
});
