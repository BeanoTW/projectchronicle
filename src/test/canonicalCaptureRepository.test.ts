import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB } from '@/local/db';
import { createCanonicalCaptureRepository } from '@/chronicle/model/canonicalCaptureRepository';

const capturedAt = '2026-08-24T21:59:00.000Z';
const sealedAt = '2026-08-24T22:00:00.000Z';

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
    const blob = new Blob(['photo-bytes'], { type: 'image/jpeg' });
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
    expect(await (await db.canonical_blobs.get('media-1'))?.blob.text()).toBe('photo-bytes');
  });

  it('records voice provenance and a daily date without inventing event time', async () => {
    const record = await repo.seal({
      id: 'record-voice', ownerId: 'owner-1', kind: 'daily', text: '', capturedAt, sealedAt,
      media: [{ id: 'voice-1', kind: 'voice', name: 'voice.webm', mime: 'audio/webm', blob: new Blob(['voice']), duration_ms: 1200 }],
    });
    expect(record.original.source).toBe('voice');
    expect(record.details.event_date).toEqual({ kind: 'exact', date: '2026-08-24' });
    expect(record.details.event_time).toBeNull();
    expect((await db.canonical_media.get('voice-1'))?.kind).toBe('voice');
  });

  it('makes an exact retry idempotent and rejects replacement wording', async () => {
    const input = { id: 'record-1', ownerId: 'owner-1', kind: 'incident' as const, text: 'Original', capturedAt, sealedAt, media: [{ id: 'media-1', kind: 'attachment' as const, name: 'a.txt', mime: 'text/plain', blob: new Blob(['same']) }] };
    const first = await repo.seal(input);
    const retry = await repo.seal(input);
    expect(retry).toEqual(first);
    expect(await db.canonical_records.count()).toBe(1);
    expect(await db.canonical_media.count()).toBe(1);
    expect(await db.canonical_history.count()).toBe(2);

    await expect(repo.seal({ ...input, text: 'Replacement' })).rejects.toThrow('cannot be replaced');
    expect((await db.canonical_records.get('record-1'))?.original.text).toBe('Original');
  });

  it('rolls the whole seal back if any original blob cannot be stored', async () => {
    await db.canonical_blobs.add({ id: 'media-1', owner_id: 'owner-1', record_id: 'other', blob: new Blob(['occupied']), stored_at: sealedAt });
    await expect(repo.seal({
      id: 'record-1', ownerId: 'owner-1', kind: 'incident', text: 'Original', capturedAt, sealedAt,
      media: [{ id: 'media-1', kind: 'attachment', name: 'a.txt', mime: 'text/plain', blob: new Blob(['new']) }],
    })).rejects.toBeTruthy();
    expect(await db.canonical_records.count()).toBe(0);
    expect(await db.canonical_media.count()).toBe(0);
    expect(await db.canonical_history.count()).toBe(0);
    expect(await db.canonical_blobs.count()).toBe(1);
  });
});
