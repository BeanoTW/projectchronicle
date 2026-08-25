import { describe, expect, it } from 'vitest';
import {
  attachmentDisplayName,
  hasCustomAttachmentName,
  normaliseAttachmentDisplayName,
} from '@/lib/attachmentName';

describe('attachment display names', () => {
  it('falls back to the immutable original filename', () => {
    expect(attachmentDisplayName({ display_name: null, file_name: 'camera-123.jpg' })).toBe('camera-123.jpg');
  });

  it('gives an opaque camera filename a useful default label', () => {
    expect(attachmentDisplayName({
      display_name: null,
      file_name: '1787483198797455197993196562465.jpg',
      file_type: 'Photo',
      mime_type: 'image/jpeg',
      upload_date: '2026-08-23T12:07:04.000Z',
      capture_date: null,
      evidence_ref_number: 2,
    })).toBe('Photo — 23 Aug 2026 (E02)');
  });

  it('keeps a meaningful original filename as the default', () => {
    expect(attachmentDisplayName({
      display_name: null,
      file_name: 'meeting-room-photo.jpg',
      file_type: 'Photo',
      upload_date: '2026-08-23T12:07:04.000Z',
      evidence_ref_number: 2,
    })).toBe('meeting-room-photo.jpg');
  });

  it('normalises user-entered names without changing the original filename', () => {
    const evidence = { display_name: normaliseAttachmentDisplayName('  Meeting   room photo  '), file_name: 'camera-123.jpg' };
    expect(attachmentDisplayName(evidence)).toBe('Meeting room photo');
    expect(evidence.file_name).toBe('camera-123.jpg');
    expect(hasCustomAttachmentName(evidence)).toBe(true);
  });

  it('rejects blank and overlong names', () => {
    expect(() => normaliseAttachmentDisplayName('   ')).toThrow('Enter a name');
    expect(() => normaliseAttachmentDisplayName('x'.repeat(121))).toThrow('120 characters');
  });
});
