// Phase 6C — preview capture adapter (isolated `chronicle_prototype` Dexie database).
// Owns all preview persistence for the shared Capture/Review views.
import { v2DB, type V2Entry } from '../db';
import { addMedia } from '../media/media';
import { writeErrorMessage } from '../media/mediaCore';
import { V2_BASE } from '../routes';
import {
  PREVIEW_DRAFT_KEY,
  type CaptureAdapter, type CaptureMediaItem, type MediaFailure, type ReviewDetails,
} from './captureModel';

export const previewCaptureAdapter: CaptureAdapter = {
  capabilities: {
    voice: true,
    attachments: true,
    storageCopy:
      'Preview data stays in Chronicle’s isolated preview storage on this device. It is not uploaded anywhere.',
    voicePrivacyNote: 'Recording. Audio stays on this device and is not sent anywhere.',
  },
  draftKey: PREVIEW_DRAFT_KEY,

  async createRecord(input) {
    const id = `proto-${input.submissionId}`;
    const existing = await v2DB.entries.get(id);
    if (existing) return { recordId: existing.id, sealedAt: existing.sealed_at };
    const entry: V2Entry = {
      id,
      original_text: input.text,
      sealed_at: input.sealedAt,
      captured_at: input.capturedAt,
      category: null,
      context: null,
      people: [],
      event_date: input.sealedAt.slice(0, 10),
      event_time: null,
      clarifications: [],
      in_dossier: false,
      title: null,
    };
    await v2DB.entries.put(entry);
    return { recordId: entry.id, sealedAt: entry.sealed_at };
  },

  async saveMedia(recordId: string, items: CaptureMediaItem[]) {
    const failures: MediaFailure[] = [];
    const now = new Date().toISOString();
    for (const item of items) {
      try {
        await addMedia({
          entry_id: recordId,
          kind: item.kind,
          role: 'original',
          name: item.name,
          mime: item.mime,
          blob: item.blob,
          description: item.description ?? null,
          duration_ms: item.duration_ms ?? null,
          added_at: now,
        });
      } catch (e) {
        failures.push({ item, message: writeErrorMessage(e) });
      }
    }
    return failures;
  },

  async saveDetails(recordId: string, details: ReviewDetails) {
    await v2DB.entries.update(recordId, {
      category: details.category,
      context: details.context,
      people: details.people,
      event_date: details.eventDate,
      event_time: details.eventTime,
    });
  },

  detailsPath: (id: string) => `${V2_BASE}/review/${id}`,
  recordPath: (id: string) => `${V2_BASE}/entry/${id}`,
  notebookPath: `${V2_BASE}/notebook`,
};
