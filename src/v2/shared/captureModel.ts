// Phase 6C — source-agnostic capture contract.
//
// The shared Capture/Review views know nothing about where a record is stored.
// A "capture adapter" owns persistence and source-specific mapping:
//   - preview adapter  → isolated `chronicle_prototype` Dexie database
//   - production adapter → canonical production record + evidence APIs
//
// This module must stay free of Dexie, Supabase, React and production hooks.

export interface CaptureCapabilities {
  /** Voice recording may be captured and stored by this source. */
  voice: boolean;
  /** Attachments may be stored by this source. */
  attachments: boolean;
  /** Shown when voice is unavailable, explaining why. */
  voiceUnavailableNote?: string;
  /** One-line description of where captured material is stored. */
  storageCopy: string;
  /** Shown inside the recorder while recording. */
  voicePrivacyNote: string;
}

export interface CaptureMediaItem {
  id: string;
  kind: 'voice' | 'attachment';
  name: string;
  mime: string;
  blob: Blob;
  description?: string | null;
  duration_ms?: number | null;
}

export interface CaptureSealInput {
  /** Stable per-capture idempotency key. Re-sealing with the same key must not duplicate. */
  submissionId: string;
  text: string;
  capturedAt: string;
  sealedAt: string;
  hasVoice: boolean;
}

export interface MediaFailure {
  item: CaptureMediaItem;
  message: string;
}

export interface ReviewDetails {
  category: string | null;
  context: string | null;
  people: string[];
  eventDate: string | null;
  eventTime: string | null;
}

export interface CaptureAdapter {
  capabilities: CaptureCapabilities;
  /** sessionStorage key for the unsealed draft. Must differ per source and per account. */
  draftKey: string;
  /** Creates the canonical record. Must be idempotent on `submissionId`. */
  createRecord(input: CaptureSealInput): Promise<{ recordId: string; sealedAt: string }>;
  /** Saves media against an already-created record. Returns per-item failures. */
  saveMedia(recordId: string, items: CaptureMediaItem[]): Promise<MediaFailure[]>;
  /** Optional review details. Must never touch original wording/timestamp/media. */
  saveDetails(recordId: string, details: ReviewDetails): Promise<void>;
  /** Where "Add details" goes. */
  detailsPath(recordId: string): string;
  /** Where "Open record" goes. */
  recordPath(recordId: string): string;
  /** Where "Finish"/"Cancel" goes. */
  notebookPath: string;
}

/** At least text or a completed voice record is required. Attachments alone are not a record. */
export const canSealCapture = (opts: {
  text: string;
  hasVoice: boolean;
  recordingActive: boolean;
}): boolean => !opts.recordingActive && (opts.text.trim().length > 0 || opts.hasVoice);

/** Anything worth warning about before leaving an unsealed capture. */
export const captureIsDirty = (opts: {
  sealed: boolean;
  text: string;
  hasVoice: boolean;
  attachmentCount: number;
  recordingActive: boolean;
}): boolean =>
  !opts.sealed &&
  (opts.recordingActive || opts.hasVoice || opts.attachmentCount > 0 || opts.text.trim().length > 0);

/** Per-account draft key so drafts never leak between users on a shared device. */
export const productionDraftKey = (userId: string | null | undefined): string =>
  `chronicle.capture.draft:${userId ?? 'anon'}`;

export const PREVIEW_DRAFT_KEY = 'proto.capture.draft';

export const parsePeople = (raw: string): string[] =>
  raw.split(',').map(p => p.trim()).filter(Boolean);

export const describeFailures = (failures: MediaFailure[]): string => {
  if (!failures.length) return '';
  const first = failures[0];
  return (
    `The record was sealed and your wording is safe. ${failures.length} item` +
    `${failures.length === 1 ? '' : 's'} could not be saved: “${first.item.name}” — ${first.message}` +
    (failures.length > 1 ? ` (and ${failures.length - 1} more).` : '') +
    ' You can retry below — nothing written has been lost.'
  );
};
