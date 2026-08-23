import { describe, expect, it } from 'vitest';
import {
  evidenceBelongsToUser,
  storageObjectIsAlreadyMissing,
} from '@/lib/attachments/deletionSafety';

describe('attachment deletion safety', () => {
  it('requires both row ownership and an owner-scoped storage path', () => {
    expect(evidenceBelongsToUser('user-a', { user_id: 'user-a', file_path: 'user-a/file.jpg' })).toBe(true);
    expect(evidenceBelongsToUser('user-a', { user_id: 'user-b', file_path: 'user-b/file.jpg' })).toBe(false);
    expect(evidenceBelongsToUser('user-a', { user_id: 'user-a', file_path: 'user-b/file.jpg' })).toBe(false);
  });

  it('allows an already-missing storage object so stale metadata can be cleaned up', () => {
    expect(storageObjectIsAlreadyMissing('Object not found')).toBe(true);
    expect(storageObjectIsAlreadyMissing('Permission denied')).toBe(false);
  });
});
