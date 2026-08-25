import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanonicalStorageBoundaryError, ChronicleDB } from '@/local/db';
import { createCanonicalLocalRepository, CanonicalImmutableConflictError } from '@/chronicle/model/canonicalLocalRepository';
import {
  CanonicalCaptureFlagBlockedError,
  disableCanonicalCapture,
  enableCanonicalCaptureForTestOwner,
  getCanonicalCaptureFlag,
  isCanonicalCaptureEnabled,
} from '@/chronicle/model/canonicalCaptureFlag';
import {
  createCanonicalCaptureAdapter,
  createCaptureWriteRouter,
  type CanonicalCaptureStore,
} from '@/chronicle/shared/canonicalCaptureAdapter';
import type { CanonicalActivationReceipt } from '@/chronicle/model/canonicalActivation';
import type { CaptureAdapter, CaptureMediaItem, CaptureSealInput } from '@/chronicle/shared/captureModel';

const ownerId = 'owner-1';
const capturedAt = '2026-08-23T20:59:00.000Z';
const sealedAt = '2026-08-23T21:00:00.000Z';
const activation = {
  version: 1,
  owner_id: ownerId,
  state: 'canonical',
  activated_at: sealedAt,
  counts: { records: 0, clarifications: 0, media: 0, history: 0, people: 0, relationships: 0 },
  inspected: { incidents: 0, notes: 0, evidence: 0, history: 0 },
} as CanonicalActivationReceipt;

const input = (mediaIds: string[] = []): CaptureSealInput => ({
  submissionId: 'record-1',
  text: '  Exact original wording.  ',
  capturedAt,
  sealedAt,
  hasVoice: false,
  media: mediaIds.map(id => ({ ...mediaItem(), id })),
  recordType: 'incident',
});

const mediaItem = (): CaptureMediaItem => ({
  id: 'media-1',
  kind: 'attachment',
  name: 'photo.jpg',
  mime: 'image/jpeg',
  blob: new Blob(['original bytes'], { type: 'image/jpeg' }),
});

describe('Phase 2 — immutable canonical Capture boundary', () => {
  let db: ChronicleDB;
  let store: ReturnType<typeof createCanonicalLocalRepository>;

  beforeEach(() => {
    db = new ChronicleDB(`chronicle_phase2_capture_${crypto.randomUUID()}`);
    store = createCanonicalLocalRepository(db, () => sealedAt);
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('is off by default and cannot be enabled without audited activation', async () => {
    expect(await getCanonicalCaptureFlag(ownerId, db)).toBeNull();
    expect(await isCanonicalCaptureEnabled(ownerId, db, async () => activation)).toBe(false);
    await expect(enableCanonicalCaptureForTestOwner(ownerId, db, async () => null))
      .rejects.toBeInstanceOf(CanonicalCaptureFlagBlockedError);

    await enableCanonicalCaptureForTestOwner(ownerId, db, async () => activation, () => sealedAt);
    expect(await isCanonicalCaptureEnabled(ownerId, db, async () => activation)).toBe(true);
    await disableCanonicalCapture(ownerId, db);
    expect(await isCanonicalCaptureEnabled(ownerId, db, async () => activation)).toBe(false);
  });

  it('seals exact wording locally without creating a legacy authoritative copy', async () => {
    const adapter = createCanonicalCaptureAdapter(ownerId, store, async () => 'hash');
    await adapter.createRecord(input());

    expect((await store.get(ownerId, 'record-1'))?.original.text).toBe('  Exact original wording.  ');
    expect(await db.incidents.count()).toBe(0);
    expect(await db.canonical_records.count()).toBe(1);
  });

  it('keeps a daily capture date without inventing an event time', async () => {
    const adapter = createCanonicalCaptureAdapter(ownerId, store, async () => 'hash');
    await adapter.createRecord({ ...input(), recordType: 'daily' });

    const record = await store.get(ownerId, 'record-1');
    expect(record?.details.event_date).toEqual({ kind: 'exact', date: '2026-08-23' });
    expect(record?.details.event_time).toBeNull();
  });

  it('rejects original replacement through the direct storage boundary', async () => {
    const adapter = createCanonicalCaptureAdapter(ownerId, store, async () => 'hash');
    await adapter.createRecord(input());
    const record = await db.canonical_records.get('record-1');
    await expect(db.canonical_records.put({
      ...record!,
      original: { ...record!.original, text: 'Rewritten behind the adapter' },
    })).rejects.toBeInstanceOf(CanonicalStorageBoundaryError);
    expect((await db.canonical_records.get('record-1'))?.original.text).toBe('  Exact original wording.  ');
  });

  it('keeps the sealed record safe when media storage fails and permits an exact retry', async () => {
    const original = mediaItem();
    let fail = true;
    const retryingStore: CanonicalCaptureStore = {
      ...store,
      async storeOriginalMedia(value, bytes) {
        if (fail) throw new Error('Simulated device write failure');
        await store.storeOriginalMedia(value, bytes);
      },
    };
    const adapter = createCanonicalCaptureAdapter(ownerId, retryingStore, async () => 'hash-1');
    await adapter.createRecord(input([original.id]));

    expect(await adapter.saveMedia('record-1', [original])).toHaveLength(1);
    expect((await store.get(ownerId, 'record-1'))?.original.text).toBe('  Exact original wording.  ');
    expect(await db.canonical_media.count()).toBe(0);

    fail = false;
    expect(await adapter.saveMedia('record-1', [original])).toEqual([]);
    expect(await db.canonical_media.count()).toBe(1);
    expect(await db.canonical_blobs.count()).toBe(1);
    expect((await db.canonical_blobs.get(original.id))?.bytes.byteLength).toBe(original.blob.size);
  });

  it('never allows a retry path to introduce a new original-media id', async () => {
    const adapter = createCanonicalCaptureAdapter(ownerId, store, async () => 'hash-1');
    await adapter.createRecord(input());
    const failures = await adapter.saveMedia('record-1', [mediaItem()]);
    expect(failures).toHaveLength(1);
    expect(await db.canonical_media.count()).toBe(0);

    const item = mediaItem();
    await expect(store.storeOriginalMedia({
      id: item.id,
      record_id: 'record-1',
      owner_id: ownerId,
      kind: 'image',
      role: 'original',
      name: item.name,
      mime: item.mime,
      size: item.blob.size,
      duration_ms: null,
      description: null,
      added_at: sealedAt,
      inclusion: { state: 'included' },
      storage: { location: 'local', ok: true },
      content_hash: 'hash-1',
      sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
    }, new ArrayBuffer(item.blob.size))).rejects.toBeInstanceOf(CanonicalImmutableConflictError);
  });

  it('keeps sealed wording intact when optional details fail', async () => {
    const failingStore: CanonicalCaptureStore = {
      ...store,
      async updateDetails() { throw new Error('Simulated details failure'); },
    };
    const adapter = createCanonicalCaptureAdapter(ownerId, failingStore);
    await adapter.createRecord(input());
    await expect(adapter.saveDetails('record-1', {
      category: 'work', context: 'meeting', people: [], eventDate: '2026-08-23', eventTime: '21:00',
    })).rejects.toThrow('Simulated details failure');
    const record = await store.get(ownerId, 'record-1');
    expect(record?.original.text).toBe('  Exact original wording.  ');
    expect(record?.details.revision_count).toBe(0);
  });

  it('routes legacy by default, canonical only when flagged, and retries by record authority', async () => {
    const calls: string[] = [];
    const fake = (name: string): CaptureAdapter => ({
      capabilities: { voice: true, attachments: true, storageCopy: '', voicePrivacyNote: '' },
      draftKey: `${name}-draft`,
      async createRecord(value) { calls.push(`${name}:create`); return { recordId: value.submissionId, sealedAt: value.sealedAt }; },
      async saveMedia() { calls.push(`${name}:media`); return []; },
      async saveDetails() { calls.push(`${name}:details`); },
      detailsPath: id => `/details/${id}`,
      recordPath: id => `/record/${id}`,
      notebookPath: '/records',
    });
    let enabled = false;
    let canonicalRecord = false;
    const router = createCaptureWriteRouter({
      legacy: fake('legacy'),
      canonical: fake('canonical'),
      canonicalEnabled: async () => enabled,
      canonicalRecordExists: async () => canonicalRecord,
    });

    await router.createRecord(input());
    enabled = true;
    await router.createRecord({ ...input(), submissionId: 'record-2' });
    enabled = false;
    canonicalRecord = true;
    await router.saveDetails('record-2', { category: null, context: null, people: [], eventDate: null, eventTime: null });
    expect(calls).toEqual(['legacy:create', 'canonical:create', 'canonical:details']);
  });
});
