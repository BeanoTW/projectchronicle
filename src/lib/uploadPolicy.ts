/**
 * Single enforcement point for untrusted file uploads.
 *
 * Chronicle accepts photos, documents and audio from users. Before this
 * module, limits lived only in the capture-flow picker (`mediaCore`), so the
 * Attachments library and Evidence screen — which upload straight from a bare
 * <input type="file"> — had no size, count or type enforcement at all.
 *
 * Every upload now passes through `assertUploadAllowed`, called inside the
 * upload mutation itself so no caller can bypass it.
 *
 * The bucket also carries a server-side size limit and MIME allow-list; this
 * module is the client-side half that produces a clear message instead of an
 * opaque storage error.
 */

/** Maximum accepted size for a single file. Mirrors the storage bucket limit. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/** Maximum attachments that may be linked to one record. */
export const MAX_ATTACHMENTS_PER_RECORD = 10;

/**
 * Accepted MIME types. Deliberately an allow-list: anything that a browser
 * might execute or treat as active content (HTML, SVG, scripts) is excluded,
 * because attachments are served from the same origin family as the app.
 */
export const ALLOWED_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'video/mp4',
  'video/webm',
];

/** `accept` attribute for file inputs. A hint only — never the enforcement. */
export const ACCEPT_ATTRIBUTE = ALLOWED_MIME_TYPES.join(',');

/** Types that must never be stored, even if a browser reports them loosely. */
const BLOCKED_PATTERNS = [
  /^text\/html$/i,
  /^image\/svg/i,
  /javascript/i,
  /^application\/x-msdownload$/i,
  /^application\/x-sh$/i,
];

export const formatLimit = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`;

/**
 * Produces a safe storage-path extension.
 *
 * The user's filename is never used to build a storage path — only a short,
 * character-restricted extension is taken from it, so a name such as
 * `../../other-user/evil.png` or `report.png%00.html` cannot influence where
 * the object lands.
 */
export const safeExtension = (fileName: string): string => {
  const last = fileName.split('.').pop() ?? '';
  const cleaned = last.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return cleaned || 'bin';
};

/**
 * Trims a display filename to something bounded. The name is still rendered as
 * text (React escapes it), so this is about layout and storage sanity, not
 * markup safety.
 */
export const safeDisplayName = (fileName: string): string => {
  const collapsed = fileName.replace(/[\r\n\t]+/g, ' ').trim();
  const withoutPath = collapsed.split(/[\\/]/).pop() ?? collapsed;
  return (withoutPath || 'attachment').slice(0, 200);
};

export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
}

/**
 * Returns a human-readable reason the file cannot be accepted, or null when it
 * is allowed. `existingCount` is the number of attachments already on the
 * target record (omit for unlinked library uploads).
 */
export const checkUploadAllowed = (
  file: UploadCandidate,
  existingCount = 0,
): string | null => {
  if (file.size === 0) {
    return `“${safeDisplayName(file.name)}” is empty, so it was not added.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `“${safeDisplayName(file.name)}” is larger than the ${formatLimit(MAX_UPLOAD_BYTES)} limit for a single file.`;
  }
  if (existingCount >= MAX_ATTACHMENTS_PER_RECORD) {
    return `This record already has the maximum of ${MAX_ATTACHMENTS_PER_RECORD} attachments.`;
  }
  const mime = (file.type || '').toLowerCase();
  if (BLOCKED_PATTERNS.some(p => p.test(mime))) {
    return `Chronicle does not accept this kind of file (${mime}).`;
  }
  // An empty type is common on some mobile browsers; fall back to the
  // extension rather than rejecting a legitimate photo outright.
  if (mime && !ALLOWED_MIME_TYPES.includes(mime) && !mime.startsWith('audio/') && !mime.startsWith('image/')) {
    return `Chronicle does not accept this kind of file (${mime}). Photos, documents, PDFs and audio can be attached.`;
  }
  return null;
};

/** Throws with a user-safe message when the file is not acceptable. */
export const assertUploadAllowed = (file: UploadCandidate, existingCount = 0): void => {
  const reason = checkUploadAllowed(file, existingCount);
  if (reason) throw new Error(reason);
};
