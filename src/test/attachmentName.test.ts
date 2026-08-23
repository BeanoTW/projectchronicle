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
