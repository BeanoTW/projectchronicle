// Prototype-only media helpers: limits, classification, formatting and safe writes.
// Everything stays inside the isolated `chronicle_prototype` IndexedDB database.
import { v2DB, type V2Media, type MediaRole } from '../db';

/* ---------- Limits (deliberately conservative for a browser-storage prototype) ---------- */
export const LIMITS = {
  MAX_FILE_BYTES: 20 * 1024 * 1024,   // 20 MB per file
  MAX_ATTACHMENTS_PER_RECORD: 10,
  MAX_VOICE_MS: 10 * 60 * 1000,       // 10 minutes
};

export const LIMITS_COPY =
  'Up to 10 files per record · 20 MB per file · voice recordings up to 10 minutes.';

export const STORAGE_COPY =
  'Files stay in this prototype’s storage on this device. They are not uploaded anywhere. ' +
  'Clearing your browser storage may remove them. Chronicle has not checked or verified file contents.';

/* ---------- Accepted types ---------- */
export const ACCEPT_ATTR = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/*', 'video/mp4', 'video/webm',
].join(',');

export type AttachmentType = 'image' | 'document' | 'audio' | 'video' | 'other';

export const attachmentType = (mime: string, name = ''): AttachmentType => {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (
    m === 'application/pdf' || m.startsWith('text/') ||
    m.includes('word') || m.includes('officedocument')
  ) return 'document';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'document';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  return 'other';
};

export const EMBEDDABLE_IMAGE = /^image\/(jpeg|png)$/i;

export const typeLabel: Record<AttachmentType, string> = {
  image: 'Image',
  document: 'Document',
  audio: 'Audio',
  video: 'Video',
  other: 'File',
};

/* ---------- Formatting ---------- */
export const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDuration = (ms: number | null | undefined): string => {
  if (!ms && ms !== 0) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/* ---------- Validation ---------- */
export interface PendingFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  description: string;
  blob: Blob;
  duration_ms?: number | null;
}

export const validateFile = (
  file: { name: string; size: number },
  currentCount: number,
): string | null => {
  if (currentCount >= LIMITS.MAX_ATTACHMENTS_PER_RECORD) {
    return `This record already has the maximum of ${LIMITS.MAX_ATTACHMENTS_PER_RECORD} attachments.`;
  }
  if (file.size > LIMITS.MAX_FILE_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(LIMITS.MAX_FILE_BYTES)} per file.`;
  }
  if (file.size === 0) return `“${file.name}” appears to be empty and was not added.`;
  return null;
};

/* ---------- Safe writes ---------- */
export const isQuotaError = (err: unknown): boolean => {
  const e = err as { name?: string; message?: string; inner?: { name?: string } } | undefined;
  const name = e?.name ?? e?.inner?.name ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  return name === 'QuotaExceededError' || name === 'QuotaExceeded' ||
    msg.includes('quota') || msg.includes('storage');
};

export const writeErrorMessage = (err: unknown): string =>
  isQuotaError(err)
    ? 'There is not enough browser storage left to save this file. Remove some prototype files, or free space on this device, then try again.'
    : 'That file could not be saved to this device’s prototype storage. Nothing else in the record was changed.';

export async function addMedia(params: {
  entry_id: string;
  kind: V2Media['kind'];
  role: MediaRole;
  name: string;
  mime: string;
  blob: Blob;
  description?: string | null;
  duration_ms?: number | null;
  added_at?: string;
}): Promise<V2Media> {
  const now = params.added_at ?? new Date().toISOString();
  const row: V2Media = {
    id: `pm-${crypto.randomUUID()}`,
    entry_id: params.entry_id,
    kind: params.kind,
    role: params.role,
    name: params.name,
    mime: params.mime,
    size: params.blob.size,
    duration_ms: params.duration_ms ?? null,
    description: params.description?.trim() || null,
    added_at: now,
    excluded_from_dossier: false,
    blob: params.blob,
  };
  await v2DB.media.add(row);
  await v2DB.media_events.add({
    id: `pe-${crypto.randomUUID()}`,
    media_id: row.id,
    entry_id: row.entry_id,
    at: now,
    action: 'added',
    detail: row.role === 'original' ? 'Present when the record was sealed' : 'Added after sealing',
  });
  return row;
}

export async function logMediaEvent(
  media: V2Media,
  action: 'described' | 'excluded' | 'included',
  detail: string | null = null,
) {
  await v2DB.media_events.add({
    id: `pe-${crypto.randomUUID()}`,
    media_id: media.id,
    entry_id: media.entry_id,
    at: new Date().toISOString(),
    action,
    detail,
  });
}

export const mediaForEntry = (entryId: string) =>
  v2DB.media.where('entry_id').equals(entryId).toArray();

/* ---------- Notebook summaries ---------- */
export interface EntryMediaSummary {
  hasVoice: boolean;
  attachmentCount: number;
  types: AttachmentType[];
}

export const emptySummary: EntryMediaSummary = { hasVoice: false, attachmentCount: 0, types: [] };

export function summariseMedia(rows: V2Media[]): Map<string, EntryMediaSummary> {
  const map = new Map<string, EntryMediaSummary>();
  rows.forEach(r => {
    const cur = map.get(r.entry_id) ?? { hasVoice: false, attachmentCount: 0, types: [] as AttachmentType[] };
    if (r.kind === 'voice') cur.hasVoice = true;
    else {
      cur.attachmentCount += 1;
      const t = attachmentType(r.mime, r.name);
      if (!cur.types.includes(t)) cur.types.push(t);
    }
    map.set(r.entry_id, cur);
  });
  return map;
}
