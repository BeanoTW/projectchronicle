import { computeSha256 } from '@/lib/attachments/integrity';
import { ChronicleDB, localDB } from '@/local/db';
import { V2MediaSchema, V2RecordSchema } from './contracts';
import { V2_SCHEMA_VERSION, type CaptureSource, type MediaKind, type SuggestionProvenance, type V2Record, type V2RecordEvent } from './schema';

export interface CanonicalCaptureMediaInput {
  id: string;
  kind: 'voice' | 'attachment';
  name: string;
  mime: string;
  blob: Blob;
  description?: string | null;
  duration_ms?: number | null;
}
export interface CanonicalCaptureInput {
  id: string;
  ownerId: string;
  kind: 'incident' | 'daily';
  text: string;
  capturedAt: string;
  sealedAt: string;
  media: readonly CanonicalCaptureMediaInput[];
  suggestionProvenance?: SuggestionProvenance;
}

const mediaKind = (item: CanonicalCaptureMediaInput): MediaKind => {
  if (item.kind === 'voice') return 'voice';
  const mime = item.mime.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || mime.startsWith('text/') || mime.includes('word') || mime.includes('officedocument')) return 'document';
  return 'other';
};
const captureSource = (text: string, media: readonly CanonicalCaptureMediaInput[]): CaptureSource => {
  const voice = media.some(item => item.kind === 'voice');
  return voice ? (text ? 'written_and_voice' : 'voice') : 'written';
};
const sync = () => ({ remote_version: null, local_revision: 0, state: { state: 'local_only' as const }, last_attempt_at: null });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const createCanonicalCaptureRepository = (db: ChronicleDB = localDB, idFactory: () => string = () => crypto.randomUUID()) => ({
  async seal(input: CanonicalCaptureInput): Promise<V2Record> {
    if (!input.id || !input.ownerId) throw new Error('Capture identity is required.');
    const ids = input.media.map(item => item.id);
    if (new Set(ids).size !== ids.length || ids.some(id => !id)) throw new Error('Original media ids must be unique and non-empty.');

    // Read each browser Blob before entering the IndexedDB transaction. The raw
    // bytes are what Chronicle persists; Blob is only a presentation/runtime wrapper.
    const prepared = await Promise.all(input.media.map(async item => {
      const [hash, bytes] = await Promise.all([computeSha256(item.blob), item.blob.arrayBuffer()]);
      const mime = item.mime || 'application/octet-stream';
      const media = V2MediaSchema.parse({
        id: item.id, record_id: input.id, owner_id: input.ownerId, kind: mediaKind(item), role: 'original',
        name: item.name, mime, size: bytes.byteLength,
        duration_ms: item.duration_ms ?? null, description: item.description?.trim() || null,
        added_at: input.sealedAt, inclusion: { state: 'included' }, storage: { location: 'local', ok: true },
        content_hash: hash, sync: sync(),
      });
      return { media, bytes, mime };
    }));

    const record = V2RecordSchema.parse({
      id: input.id, owner_id: input.ownerId, kind: input.kind, schema_version: V2_SCHEMA_VERSION,
      original: { text: input.text, source: captureSource(input.text, input.media), media_ids: ids, sealed_at: input.sealedAt, ...(input.suggestionProvenance ? { suggestion_provenance: structuredClone(input.suggestionProvenance) } : {}) },
      details: { title: null, category_id: null, context: null, person_ids: [], location: null, event_date: input.kind === 'daily' ? { kind: 'exact', date: input.sealedAt.slice(0, 10) } : null, event_time: null, revision_count: 0 },
      lifecycle: { state: 'sealed' }, dossier: { state: 'not_included' },
      captured_at: input.capturedAt, sealed_at: input.sealedAt, created_at: input.sealedAt, updated_at: input.sealedAt, sync: sync(),
    });

    return db.transaction('rw', db.canonical_records, db.canonical_media, db.canonical_blobs, db.canonical_history, async () => {
      const existing = await db.canonical_records.get(input.id);
      if (existing) {
        if (!same(existing.original, record.original) || existing.owner_id !== input.ownerId || existing.kind !== input.kind || existing.captured_at !== input.capturedAt || existing.sealed_at !== input.sealedAt) {
          throw new Error('A sealed canonical capture cannot be replaced.');
        }
        for (const { media, bytes } of prepared) {
          const storedMedia = await db.canonical_media.get(media.id);
          const storedBytes = await db.canonical_blobs.get(media.id);
          if (!storedMedia || storedMedia.owner_id !== media.owner_id || storedMedia.record_id !== media.record_id || storedMedia.content_hash !== media.content_hash || !storedBytes || storedBytes.owner_id !== media.owner_id || storedBytes.record_id !== media.record_id || storedBytes.size !== bytes.byteLength) {
            throw new Error('Canonical capture retry does not match its sealed original media.');
          }
        }
        return V2RecordSchema.parse(existing);
      }

      await db.canonical_records.add(record);
      const sealedEvent: V2RecordEvent = { id: idFactory(), record_id: record.id, owner_id: record.owner_id, at: record.sealed_at, action: 'sealed', field: null, from_value: null, to_value: null, actor: 'user' };
      await db.canonical_history.add(sealedEvent);
      if (record.original.suggestion_provenance?.accepted_into_original) {
        await db.canonical_history.add({ id: idFactory(), record_id: record.id, owner_id: record.owner_id, at: record.sealed_at, action: 'suggestion_provenance_recorded', field: 'original.suggestion_provenance', from_value: null, to_value: 'Accepted Input Helper suggestion(s) were included at seal time.', actor: 'system' });
      }
      for (const { media, bytes, mime } of prepared) {
        await db.canonical_media.add(media);
        await db.canonical_blobs.add({ id: media.id, owner_id: record.owner_id, record_id: record.id, bytes, mime, size: bytes.byteLength, stored_at: record.sealed_at });
        await db.canonical_history.add({ id: idFactory(), record_id: record.id, owner_id: record.owner_id, at: record.sealed_at, action: 'media_added', field: media.id, from_value: null, to_value: null, actor: 'user' });
      }
      return record;
    });
  },
});

export const canonicalCaptureRepository = createCanonicalCaptureRepository();
