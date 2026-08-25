import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB } from '@/local/db';
import { createCanonicalCaptureRepository } from '@/chronicle/model/canonicalCaptureRepository';

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

describe('Phase 12 — atomic canonical capture', () => {
  let db: ChronicleDB;
  let repo: ReturnType<typeof createCanonicalCaptureRepository>;

  beforeEach(() => {
    db = new ChronicleDB(`chronicle_phase12_${crypto.randomUUID()}`);
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

  it('records voice provenance and a daily date without inventing event time', async () => {
    const record = await repo.seal({
      id: 'record-voice', ownerId: 'owner-1', kind: 'daily', text: '', capturedAt, sealedAt,
      media: [{ id: 'voice-1', kind: 'voice', name: 'voice.webm', mime: 'audio/webm', blob: browserBlob('voice', 'audio/webm'), duration_ms: 1200 }],
    });
    expect(record.original.source).toBe('voice');
    expect(record.details.event_date).toEqual({ kind: 'exact', date: '2026-08-24' });
    expect(record.details.event_time).toBeNull();
    expect((await db.canonical_media.get('voice-1'))?.kind).toBe('voice');
  });

  it('stores accepted helper provenance inside the immutable original and surfaces a history event', async () => {
    const record = await repo.seal({
      id: 'record-assisted', ownerId: 'owner-1', kind: 'incident', text: 'Accepted wording', capturedAt, sealedAt,
      media: [],
      suggestionProvenance: {
        provenance_version: 1, tracking_available: true, interaction_occurred: true,
        accepted_into_original: true, helpers: [{ helper: 'input-helper', helper_version: '1', model: null }],
      },
    });

    expect(record.original.suggestion_provenance?.accepted_into_original).toBe(true);
    expect((await db.canonical_history.where('record_id').equals(record.id).toArray()).map(event => event.action))
      .toEqual(['sealed', 'suggestion_provenance_recorded']);
    await expect(repo.seal({
      id: 'record-assisted', ownerId: 'owner-1', kind: 'incident', text: 'Accepted wording', capturedAt, sealedAt,
      media: [],
    })).rejects.toThrow('cannot be replaced');
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
