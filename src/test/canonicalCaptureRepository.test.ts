import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB } from '@/local/db';
import { createCanonicalCaptureRepository, provenanceLabel } from '@/chronicle/model/canonicalCaptureRepository';

const capturedAt = '2026-08-24T21:59:00.000Z';
const sealedAt = '2026-08-24T22:00:00.000Z';

// jsdom's Blob in this test environment predates the browser-standard
// arrayBuffer() method. Chronicle runs in browsers where Blob.arrayBuffer()
// exists, so make the fixture browser-faithful instead of weakening hashing.
const browserBlob = (text: string, type = ''): Blob => {
  const blob = new Blob([text], { type });
  const bytes = new TextEncoder().encode(text);
  Object.defineProperty(blob, 'arrayBuffer', {
    configurable: true,
    value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return blob;
};

describe('Phase 4 — atomic canonical capture integrity', () => {
  let db: ChronicleDB;
  let repo: ReturnType<typeof createCanonicalCaptureRepository>;

  beforeEach(() => {
    db = new ChronicleDB(`chronicle_phase4_${crypto.randomUUID()}`);
    let n = 0;
    repo = createCanonicalCaptureRepository(db, () => `history-${++n}`);
  });
  afterEach(async () => { db.close(); await db.delete(); });

  it('seals wording, original media metadata and bytes atomically without creating V1 rows', async () => {
    const blob = browserBlob('photo-bytes', 'image/jpeg');
    const record = await repo.seal({
      id: 'record-1', ownerId: 'owner-1', kind: 'incident', text: '  Exact wording stays.  ', capturedAt, sealedAt,
      media: [{ id: 'media-1', kind: 'attachment', name: 'photo.jpg', mime: 'image/jpeg', blob, description: 'Doorway' }],
    });

    expect(record.original.text).toBe('  Exact wording stays.  ');
    expect(record.original.media_ids).toEqual(['media-1']);
    expect(record.original.source).toBe('written');
    expect(record.original.provenance).toEqual({ schema_version: 1, tracking_state: 'NOT_RECORDED' });
    expect(await db.incidents.count()).toBe(0);
    expect(await db.canonical_records.count()).toBe(1);
    expect(await db.canonical_media.count()).toBe(1);
    expect(await db.canonical_blobs.count()).toBe(1);
    expect(await db.canonical_history.count()).toBe(2);
    const media = await db.canonical_media.get('media-1');
    expect(media?.role).toBe('original');
    expect(media?.storage).toEqual({ location: 'local', ok: true });
    expect(media?.content_hash).toMatch(/^[a-f0-9]{64}$/);
    const stored = await db.canonical_blobs.get('media-1');
    expect(stored?.owner_id).toBe('owner-1');
    expect(stored?.record_id).toBe('record-1');
    expect(stored?.size).toBe(blob.size);
    expect(stored?.mime).toBe('image/jpeg');
    expect(new TextDecoder().decode(stored?.bytes)).toBe('photo-bytes');
  });

  it('does not invent an event date from the seal timestamp', async () => {
    const record = await repo.seal({
      id: 'record-voice', ownerId: 'owner-1', kind: 'daily', text: '', capturedAt, sealedAt,
      media: [{ id: 'voice-1', kind: 'voice', name: 'voice.webm', mime: 'audio/webm', blob: browserBlob('voice', 'audio/webm'), duration_ms: 1200 }],
    });
    expect(record.original.source).toBe('voice');
    expect(record.details.event_date).toBeNull();
    expect(record.details.event_time).toBeNull();
    expect((await db.canonical_media.get('voice-1'))?.kind).toBe('voice');
  });

  it('freezes accepted Input Helper provenance and creates one neutral acceptance history event', async () => {
    const provenance = {
      schema_version: 1 as const,
      tracking_state: 'RECORDED' as const,
      input_helper: {
        interaction_state: 'SUGGESTION_ACCEPTED' as const,
        accepted_suggestion_count: 2,
        helper_version: 'structure-helper/1.0',
      },
    };
    const record = await repo.seal({ id: 'helper-1', ownerId: 'owner-1', kind: 'incident', text: 'Original', capturedAt, sealedAt, media: [], provenance });
    expect(record.original.provenance).toEqual(provenance);
    const history = await db.canonical_history.where('record_id').equals('helper-1').toArray();
    expect(history.map(event => event.action)).toEqual(['sealed', 'input_helper_accepted']);
    expect(history[1].to_value).toBe(JSON.stringify({ acceptedSuggestionCount: 2, helperVersion: 'structure-helper/1.0' }));

    await expect(repo.seal({
      id: 'helper-1', ownerId: 'owner-1', kind: 'incident', text: 'Original', capturedAt, sealedAt, media: [],
      provenance: { ...provenance, input_helper: { ...provenance.input_helper, helper_version: 'structure-helper/2.0' } },
    })).rejects.toThrow('cannot be replaced');
    expect((await db.canonical_records.get('helper-1'))?.original.provenance).toEqual(provenance);
  });

  it('does not create acceptance history when suggestions were ignored', async () => {
    await repo.seal({
      id: 'helper-ignored', ownerId: 'owner-1', kind: 'incident', text: 'Original', capturedAt, sealedAt, media: [],
      provenance: {
        schema_version: 1,
        tracking_state: 'RECORDED',
        input_helper: { interaction_state: 'SHOWN_NO_INTERACTION', helper_version: 'structure-helper/1.0' },
      },
    });
    const history = await db.canonical_history.where('record_id').equals('helper-ignored').toArray();
    expect(history.map(event => event.action)).toEqual(['sealed']);
  });

  it('renders legacy provenance absence as not recorded, never helper unused', () => {
    expect(provenanceLabel(undefined)).toBe('Provenance not recorded');
    expect(provenanceLabel({ schema_version: 1, tracking_state: 'NOT_RECORDED' })).toBe('Provenance not recorded');
  });

  it('makes an exact retry idempotent and rejects replacement wording', async () => {
    const input = { id: 'record-1', ownerId: 'owner-1', kind: 'incident' as const, text: 'Original', capturedAt, sealedAt, media: [{ id: 'media-1', kind: 'attachment' as const, name: 'a.txt', mime: 'text/plain', blob: browserBlob('same', 'text/plain') }] };
    const first = await repo.seal(input);
    const retry = await repo.seal(input);
    expect(retry).toEqual(first);
    expect(await db.canonical_records.count()).toBe(1);
    expect(await db.canonical_media.count()).toBe(1);
    expect(await db.canonical_history.count()).toBe(2);

    await expect(repo.seal({ ...input, text: 'Replacement' })).rejects.toThrow('cannot be replaced');
    expect((await db.canonical_records.get('record-1'))?.original.text).toBe('Original');
  });

  it('rolls the whole seal back if any original byte row cannot be stored', async () => {
    const occupied = new TextEncoder().encode('occupied');
    await db.canonical_blobs.add({ id: 'media-1', owner_id: 'owner-1', record_id: 'other', bytes: occupied.buffer, mime: 'text/plain', size: occupied.byteLength, stored_at: sealedAt });
    await expect(repo.seal({
      id: 'record-1', ownerId: 'owner-1', kind: 'incident', text: 'Original', capturedAt, sealedAt,
      media: [{ id: 'media-1', kind: 'attachment', name: 'a.txt', mime: 'text/plain', blob: browserBlob('new', 'text/plain') }],
    })).rejects.toBeTruthy();
    expect(await db.canonical_records.count()).toBe(0);
    expect(await db.canonical_media.count()).toBe(0);
    expect(await db.canonical_history.count()).toBe(0);
    expect(await db.canonical_blobs.count()).toBe(1);
  });
});
