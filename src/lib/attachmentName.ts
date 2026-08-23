import type { EvidenceFile } from '@/hooks/useEvidence';

export const MAX_ATTACHMENT_DISPLAY_NAME_LENGTH = 120;

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
  evidence: Pick<EvidenceFile, 'display_name' | 'file_name'>,
): string => evidence.display_name?.trim() || evidence.file_name;

export const hasCustomAttachmentName = (
  evidence: Pick<EvidenceFile, 'display_name' | 'file_name'>,
): boolean => Boolean(evidence.display_name?.trim() && evidence.display_name.trim() !== evidence.file_name);
