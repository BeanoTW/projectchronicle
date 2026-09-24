import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalRecordReader } from '@/chronicle/model/adapters';
import {
  activateCanonicalOwner,
  auditCanonicalActivation,
  canonicalActivationBlocked,
  canonicalActivationKey,
  CanonicalActivationBlockedError,
  createCanonicalReadRouter,
  getCanonicalActivation,
} from '@/chronicle/model/canonicalActivation';
import { applyCanonicalMigration, buildCanonicalMigration } from '@/chronicle/model/canonicalMigration';
import { hydrateCanonicalMigrationMedia } from '@/chronicle/model/canonicalMigrationMedia';
import type { V1Snapshot } from '@/chronicle/model/migrationPlan';
import { ChronicleDB } from '@/local/db';

const at = (minute: number) => new Date(Date.parse('2026-08-23T18:00:00.000Z') + minute * 60_000).toISOString();
const LEGACY_MEDIA_BYTES = new TextEncoder().encode('photo-bytes');
const LEGACY_MEDIA_SHA256 = 'dac6f451810bc38390a3b6e278d686b332a77cf21b2ea95145ad73722b77035d';
const legacyMediaDownload = async (path: string): Promise<Blob> => {
  expect(path).toBe('owner-1/photo.jpg');
  const bytes = LEGACY_MEDIA_BYTES.slice();
  return {
    size: bytes.byteLength,
    type: 'image/jpeg',
    arrayBuffer: async () => bytes.buffer,
  } as Blob;
};

const cleanSnapshot = (): V1Snapshot => ({
  incidents: [{
    id: 'record-1', user_id: 'owner-1', raw_narrative: 'Exact legacy wording.', record_type: 'incident',
    incident_date: '2026-08-23', record_date: null, incident_time: '18:00', category: 'Workplace',
    created_at: at(0), original_created_at: at(-1), excluded_from_rep: false,
    people_involved: ['Alex Smith'], witnesses: [], title: 'Meeting', context_domain: 'employment',
    location: 'Office', updated_at: at(1), last_modified_at: at(1), version: 1,
    voided_at: null, void_reason: null,
  } as V1Snapshot['incidents'][number]],
  notes: [{ id: 'note-1', incident_id: 'record-1', note_text: 'Follow-up.', note_type: 'Update', created_at: at(2) }],
  evidence: [{ id: 'media-1', incident_id: 'record-1', file_name: 'photo.jpg', file_path: 'owner-1/photo.jpg', file_hash: LEGACY_MEDIA_SHA256, mime_type: 'image/jpeg', upload_date: at(3), file_size: LEGACY_MEDIA_BYTES.byteLength } as V1Snapshot['evidence'][number]],
  history: [{ id: 'history-1', incident_id: 'record-1', field_changed: 'title', changed_at: at(4), edit_source: 'user', old_value: 'Old', new_value: 'Meeting' } as V1Snapshot['history'][number]],
});

describe('Phase 5 — canonical activation guard', () => {
  let db: ChronicleDB;
  beforeEach(() => { db = new ChronicleDB(`chronicle_phase5_${crypto.randomUUID()}`); });
  afterEach(async () => { db.close(); await db.delete(); });

  it('stays unactivated until every expected canonical row and evidence byte is verified', async () => {
    const build = buildCanonicalMigration(cleanSnapshot());
    const before = await auditCanonicalActivation(build, 'owner-1', db);
    expect(before.ok).toBe(false);
    if (canonicalActivationBlocked(before)) expect(before.reasons).toEqual(expect.arrayContaining([expect.stringContaining('is missing')]));
    expect(await getCanonicalActivation('owner-1', db)).toBeNull();
    await applyCanonicalMigration(build, db);
    const metadataOnly = await auditCanonicalActivation(build, 'owner-1', db);
    expect(metadataOnly.ok).toBe(false);
    if (canonicalActivationBlocked(metadataOnly)) expect(metadataOnly.reasons).toContain('media:media-1:verified local bytes are missing');
    const imported = await hydrateCanonicalMigrationMedia(build, 'owner-1', db, legacyMediaDownload, () => at(9));
    expect(imported).toEqual({ inspected: 1, imported: 1, already_verified: 0 });
    const repeated = await hydrateCanonicalMigrationMedia(build, 'owner-1', db, legacyMediaDownload, () => at(9));
    expect(repeated).toEqual({ inspected: 1, imported: 0, already_verified: 1 });
    const audit = await auditCanonicalActivation(build, 'owner-1', db);
    expect(audit).toEqual({ ok: true, counts: { records: 1, clarifications: 1, media: 1, history: 1, people: 1, organisations: 0, relationships: 1 } });
    const receipt = await activateCanonicalOwner(build, 'owner-1', db, () => at(10));
    expect(receipt).toMatchObject({ owner_id: 'owner-1', state: 'canonical', activated_at: at(10), counts: { organisations: 0 } });
    expect(await getCanonicalActivation('owner-1', db)).toEqual(receipt);
  });

  it('blocks activation on unresolved migration issues even when mapped rows were written', async () => {
    const source = cleanSnapshot(); source.incidents[0].incident_time = 'sometime after lunch';
    const build = buildCanonicalMigration(source); await applyCanonicalMigration(build, db);
    const audit = await auditCanonicalActivation(build, 'owner-1', db);
    expect(audit.ok).toBe(false);
    if (canonicalActivationBlocked(audit)) expect(audit.reasons).toContain('incident:record-1:malformed_event_time');
    await expect(activateCanonicalOwner(build, 'owner-1', db)).rejects.toBeInstanceOf(CanonicalActivationBlockedError);
    expect(await getCanonicalActivation('owner-1', db)).toBeNull();
  });

  it('blocks activation if canonical data changed or an unexpected row appeared before cutover', async () => {
    const build = buildCanonicalMigration(cleanSnapshot()); await applyCanonicalMigration(build, db);
    const stored = await db.canonical_records.get('record-1');
    await db.canonical_records.put({ ...stored!, details: { ...stored!.details, title: 'Changed behind audit' } });
    let audit = await auditCanonicalActivation(build, 'owner-1', db);
    expect(audit.ok).toBe(false);
    if (canonicalActivationBlocked(audit)) expect(audit.reasons).toContain('record:record-1 differs from the audited migration build');
    await db.canonical_records.put(build.records[0]);
    await db.canonical_people.add({ id: 'extra-person', owner_id: 'owner-1', display_name: 'Extra', normalised_name: 'extra', role_note: null, created_at: at(0), merged_into_id: null });
    audit = await auditCanonicalActivation(build, 'owner-1', db);
    expect(audit.ok).toBe(false);
    if (canonicalActivationBlocked(audit)) expect(audit.reasons).toContain('person:extra-person is unexpected before activation');
  });

  it('blocks activation when an unaudited organisation row exists', async () => {
    const build = buildCanonicalMigration(cleanSnapshot()); await applyCanonicalMigration(build, db);
    await db.canonical_organisations.add({ id: 'extra-org', owner_id: 'owner-1', display_name: 'Example Ltd', normalised_name: 'example ltd', note: null, created_at: at(0), merged_into_id: null });
    const audit = await auditCanonicalActivation(build, 'owner-1', db);
    expect(audit.ok).toBe(false);
    if (canonicalActivationBlocked(audit)) expect(audit.reasons).toContain('organisation:extra-org is unexpected before activation');
  });

  it('accepts an old receipt only while no unaudited organisation rows exist', async () => {
    const oldReceipt = { version: 1, owner_id: 'owner-1', state: 'canonical', activated_at: at(0), counts: { records: 1, clarifications: 1, media: 1, history: 1, people: 1, relationships: 1 }, inspected: { incidents: 1, notes: 1, evidence: 1, history: 1 } };
    await db.meta.put({ key: canonicalActivationKey('owner-1'), value: JSON.stringify(oldReceipt) });
    expect(await getCanonicalActivation('owner-1', db)).not.toBeNull();
    await db.canonical_organisations.add({ id: 'post-old-receipt-org', owner_id: 'owner-1', display_name: 'Later Org', normalised_name: 'later org', note: null, created_at: at(1), merged_into_id: null });
    expect(await getCanonicalActivation('owner-1', db)).toBeNull();
  });

  it('treats malformed or foreign activation receipts as inactive', async () => {
    await db.meta.put({ key: canonicalActivationKey('owner-1'), value: '{bad json' });
    expect(await getCanonicalActivation('owner-1', db)).toBeNull();
    await db.meta.put({ key: canonicalActivationKey('owner-1'), value: JSON.stringify({ version: 1, owner_id: 'owner-2', state: 'canonical', activated_at: at(0), counts: {}, inspected: {} }) });
    expect(await getCanonicalActivation('owner-1', db)).toBeNull();
  });

  it('routes to legacy by default and only canonical after an activation receipt exists', async () => {
    const legacyGet = vi.fn(async () => null); const legacyList = vi.fn(async () => []); const canonicalGet = vi.fn(async () => null); const canonicalList = vi.fn(async () => []);
    const legacy: CanonicalRecordReader = { get: legacyGet, list: legacyList }; const canonical: CanonicalRecordReader = { get: canonicalGet, list: canonicalList };
    const router = createCanonicalReadRouter(legacy, canonical, ownerId => getCanonicalActivation(ownerId, db));
    await router.list('owner-1'); expect(legacyList).toHaveBeenCalledTimes(1); expect(canonicalList).not.toHaveBeenCalled();
    const build = buildCanonicalMigration(cleanSnapshot()); await applyCanonicalMigration(build, db); await hydrateCanonicalMigrationMedia(build, 'owner-1', db, legacyMediaDownload, () => at(9)); await activateCanonicalOwner(build, 'owner-1', db, () => at(10));
    await router.get('owner-1', 'record-1'); expect(canonicalGet).toHaveBeenCalledTimes(1); expect(legacyGet).not.toHaveBeenCalled();
  });
});
