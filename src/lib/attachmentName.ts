import type { EvidenceFile } from '@/hooks/useEvidence';

export const MAX_ATTACHMENT_DISPLAY_NAME_LENGTH = 120;

interface AttachmentNameSource {
  display_name?: string | null;
  file_name: string;
  file_type?: string | null;
  mime_type?: string | null;
  upload_date?: string | null;
  capture_date?: string | null;
  evidence_ref_number?: number | null;
}

export const normaliseAttachmentDisplayName = (value: string): string => {
  const normalised = value.trim().replace(/\s+/g, ' ');
  if (!normalised) {
    throw new Error('Enter a name for this attachment.');
  }
  if (normalised.length > MAX_ATTACHMENT_DISPLAY_NAME_LENGTH) {
    throw new Error(`Attachment names must be ${MAX_ATTACHMENT_DISPLAY_NAME_LENGTH} characters or fewer.`);
  }
  return normalised;
};

export const attachmentDisplayName = (
  evidence: AttachmentNameSource,
): string => {
  const custom = evidence.display_name?.trim();
  if (custom) return custom;

  const stem = evidence.file_name.replace(/\.[^.]+$/, '');
  const opaque = /^\d{12,}$/.test(stem) || /^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(stem) || /^[a-f\d]{24,}$/i.test(stem);
  if (!opaque) return evidence.file_name;

  const mime = evidence.mime_type?.toLowerCase() ?? '';
  const kind = evidence.file_type?.trim()
    || (mime.startsWith('image/') ? 'Photo' : mime.startsWith('audio/') ? 'Audio' : mime.startsWith('video/') ? 'Video' : 'Attachment');
  const rawDate = evidence.capture_date ?? evidence.upload_date;
  const parsed = rawDate ? new Date(rawDate) : null;
  const date = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const ref = evidence.evidence_ref_number == null ? null : `E${String(evidence.evidence_ref_number).padStart(2, '0')}`;
  return [kind, date].filter(Boolean).join(' — ') + (ref ? ` (${ref})` : '');
};

export const hasCustomAttachmentName = (
  evidence: Pick<EvidenceFile, 'display_name' | 'file_name'>,
): boolean => Boolean(evidence.display_name?.trim() && evidence.display_name.trim() !== evidence.file_name);
