// Phase 2 — canonical Capture implementation for explicitly flagged owners.
//
// It writes only to the additive local canonical store. Network access is not
// required to seal wording, save details or retain media bytes.
import type { CanonicalRecordReader, CanonicalRecordWriter } from '@/chronicle/model/adapters';
import type { MediaKind, V2Media } from '@/chronicle/model/schema';
import { computeSha256 } from '@/lib/attachments/integrity';
import {
  productionDraftKey,
  type CaptureAdapter,
  type CaptureMediaItem,
  type MediaFailure,
} from './captureModel';

export type CanonicalCaptureStore = CanonicalRecordReader & CanonicalRecordWriter;

export class CanonicalCapturePeopleDeferredError extends Error {}

const readBlobBytes = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Media bytes could not be read.'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
};

const mediaKind = (item: CaptureMediaItem): MediaKind => {
  if (item.kind === 'voice') return 'voice';
  if (item.mime.startsWith('image/')) return 'image';
  if (item.mime.startsWith('video/')) return 'video';
  if (item.mime.startsWith('audio/')) return 'audio';
  if (item.mime === 'application/pdf' || item.mime.startsWith('text/')) return 'document';
  return 'other';
};

export const createCanonicalCaptureAdapter = (
  ownerId: string,
  store: CanonicalCaptureStore,
  hash: (blob: Blob) => Promise<string> = computeSha256,
): CaptureAdapter => ({
  capabilities: {
    voice: true,
    attachments: true,
    recordTypes: true,
    storageCopy: 'Your record and attached material are saved on this device first.',
    voicePrivacyNote: 'Recording. When you seal, the audio is saved on this device first.',
  },
  draftKey: productionDraftKey(ownerId),

  async createRecord(input) {
    if (!ownerId) throw new Error('Not signed in');
    const originalMediaIds = [...new Set(input.originalMediaIds)];
    if (originalMediaIds.length !== input.originalMediaIds.length || originalMediaIds.some(id => !id)) {
      throw new Error('Capture media ids must be unique and non-empty.');
    }
    const hasWrittenWords = input.text.trim().length > 0;
    const record = await store.seal({
      id: input.submissionId,
      owner_id: ownerId,
      kind: input.recordType,
      original: {
        text: input.text,
        source: input.hasVoice ? (hasWrittenWords ? 'written_and_voice' : 'voice') : 'written',
        media_ids: originalMediaIds,
        sealed_at: input.sealedAt,
      },
      captured_at: input.capturedAt,
      sealed_at: input.sealedAt,
    });
    return { recordId: record.id, sealedAt: record.sealed_at };
  },

  async saveMedia(recordId, items) {
    const record = await store.get(ownerId, recordId);
    if (!record) return items.map(item => ({ item, message: 'The sealed record could not be found.' }));

    const failures: MediaFailure[] = [];
    for (const item of items) {
      try {
        if (!record.original.media_ids.includes(item.id)) {
          throw new Error('This item was not part of the sealed capture.');
        }
        const [contentHash, bytes] = await Promise.all([hash(item.blob), readBlobBytes(item.blob)]);
        const media: V2Media = {
          id: item.id,
          record_id: record.id,
          owner_id: ownerId,
          kind: mediaKind(item),
          role: 'original',
          name: item.name,
          mime: item.mime || 'application/octet-stream',
          size: item.blob.size,
          duration_ms: item.duration_ms ?? null,
          description: item.description?.trim() || null,
          added_at: record.sealed_at,
          inclusion: { state: 'included' },
          storage: { location: 'local', ok: true },
          content_hash: contentHash,
          sync: {
            remote_version: null,
            local_revision: 0,
            state: { state: 'local_only' },
            last_attempt_at: null,
          },
        };
        await store.storeOriginalMedia(media, bytes);
      } catch {
        failures.push({ item, message: 'This item could not be stored on this device. Please retry.' });
      }
    }
    return failures;
  },

  async saveDetails(recordId, details) {
    if (details.people.length > 0) {
      throw new CanonicalCapturePeopleDeferredError(
        'People can be added after this test record is sealed; no names were saved or discarded.',
      );
    }
    const record = await store.get(ownerId, recordId);
    if (!record) throw new Error('The sealed record could not be found.');
    await store.updateDetails(ownerId, recordId, record.details.revision_count, {
      category_id: details.category,
      context: details.context,
      event_date: details.eventDate ? { kind: 'exact', date: details.eventDate } : null,
      event_time: details.eventTime,
    });
  },

  detailsPath: id => `/record/details/${id}`,
  recordPath: id => `/incident/${id}`,
  notebookPath: '/timeline',
});

export const createCaptureWriteRouter = (options: {
  legacy: CaptureAdapter;
  canonical: CaptureAdapter;
  canonicalEnabled: () => Promise<boolean>;
  canonicalRecordExists: (recordId: string) => Promise<boolean>;
}): CaptureAdapter => ({
  capabilities: options.legacy.capabilities,
  draftKey: options.legacy.draftKey,
  async createRecord(input) {
    return (await options.canonicalEnabled() ? options.canonical : options.legacy).createRecord(input);
  },
  async saveMedia(recordId, items) {
    return (await options.canonicalRecordExists(recordId) ? options.canonical : options.legacy).saveMedia(recordId, items);
  },
  async saveDetails(recordId, details) {
    return (await options.canonicalRecordExists(recordId) ? options.canonical : options.legacy).saveDetails(recordId, details);
  },
  detailsPath: options.legacy.detailsPath,
  recordPath: options.legacy.recordPath,
  notebookPath: options.legacy.notebookPath,
});
