// Chronicle V2 shared media helpers: limits, classification, formatting, validation.
// Storage-agnostic on purpose — no Dexie, no Supabase, no production hooks.
// Both the preview (Dexie) and production (Supabase evidence) adapters build on this.

/* ---------- Limits (deliberately conservative for a browser-storage candidate) ---------- */
export const LIMITS = {
  MAX_FILE_BYTES: 20 * 1024 * 1024,   // 20 MB per file
  MAX_ATTACHMENTS_PER_RECORD: 10,
  MAX_VOICE_MS: 10 * 60 * 1000,       // 10 minutes
};

export const LIMITS_COPY =
  'Up to 10 files per record · 20 MB per file · voice recordings up to 10 minutes.';

export const STORAGE_COPY =
  'Files stay in Chronicle’s local storage on this device. They are not uploaded anywhere. ' +
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
    ? 'There is not enough browser storage left to save this file. Remove some files, or free space on this device, then try again.'
    : 'That file could not be saved to this device’s local storage. Nothing else in the record was changed.';

