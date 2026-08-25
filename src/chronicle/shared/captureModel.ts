// Source-agnostic capture contract. Persistence belongs to the injected adapter.
import type { InputHelperInteractionState } from '@/chronicle/model/schema';

export interface CaptureCapabilities {
  voice: boolean;
  attachments: boolean;
  voiceUnavailableNote?: string;
  storageCopy: string;
  voicePrivacyNote: string;
  recordTypes?: boolean;
  /** Optional structure-only assistance before seal. */
  inputHelper?: boolean;
}
export type CaptureRecordType = 'incident' | 'daily';
export interface CaptureMediaItem {
  /** Stable id allocated before seal so original media can later be bound atomically to the record. */
  id: string;
  kind: 'voice' | 'attachment';
  name: string;
  mime: string;
  blob: Blob;
  description?: string | null;
  duration_ms?: number | null;
}
export interface CaptureInputHelperState {
  interactionState: InputHelperInteractionState;
  acceptedSuggestionCount?: number;
  helperVersion?: string;
}
export interface CaptureSealInput {
  submissionId: string;
  text: string;
  capturedAt: string;
  sealedAt: string;
  hasVoice: boolean;
  recordType: CaptureRecordType;
  /** Actual pre-seal helper participation, frozen by the canonical seal. */
  inputHelper?: CaptureInputHelperState;
  /** Media present at seal. Persistence may complete afterwards through retry. */
  media?: readonly CaptureMediaItem[];
}
export interface MediaFailure { item: CaptureMediaItem; message: string; }
export interface ReviewDetails { category: string | null; context: string | null; people: string[]; eventDate: string | null; eventTime: string | null; }
export interface CaptureAdapter {
  capabilities: CaptureCapabilities;
  draftKey: string;
  createRecord(input: CaptureSealInput): Promise<{ recordId: string; sealedAt: string }>;
  saveMedia(recordId: string, items: CaptureMediaItem[]): Promise<MediaFailure[]>;
  saveDetails(recordId: string, details: ReviewDetails): Promise<void>;
  detailsPath(recordId: string): string;
  recordPath(recordId: string): string;
  notebookPath: string;
}
export const canSealCapture = (opts: { text: string; hasVoice: boolean; recordingActive: boolean }): boolean => !opts.recordingActive && (opts.text.trim().length > 0 || opts.hasVoice);
export const captureIsDirty = (opts: { sealed: boolean; text: string; hasVoice: boolean; attachmentCount: number; recordingActive: boolean }): boolean => !opts.sealed && (opts.recordingActive || opts.hasVoice || opts.attachmentCount > 0 || opts.text.trim().length > 0);
export const productionDraftKey = (userId: string | null | undefined): string => `chronicle.capture.draft:${userId ?? 'anon'}`;
export const PREVIEW_DRAFT_KEY = 'proto.capture.draft';
export const parsePeople = (raw: string): string[] => raw.split(',').map(p => p.trim()).filter(Boolean);
export const describeFailures = (failures: MediaFailure[]): string => {
  if (!failures.length) return '';
  const first = failures[0];
  return `The record was sealed and your wording is safe. ${failures.length} item${failures.length === 1 ? '' : 's'} could not be saved: “${first.item.name}” — ${first.message}${failures.length > 1 ? ` (and ${failures.length - 1} more).` : ''} You can retry below — nothing written has been lost.`;
};
