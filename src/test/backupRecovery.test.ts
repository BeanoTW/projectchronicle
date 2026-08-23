import { describe, expect, it } from 'vitest';
import {
  backupStatusLabel,
  canRestoreCloudBackup,
  formatBackupDate,
} from '@/lib/backup/backupRecovery';

const base = {
  backupEnabled: true,
  online: true,
  pendingCount: 0,
  conflictCount: 0,
  syncStatus: 'in_sync' as const,
  lastBackupAt: '2026-08-23T12:00:00.000Z',
};

describe('backup recovery status', () => {
  it('prioritises conflicts over a superficially in-sync count', () => {
    expect(backupStatusLabel({ ...base, conflictCount: 2 })).toBe('2 records need review');
  });

  it('explains pending offline backup without implying data loss', () => {
    expect(backupStatusLabel({ ...base, online: false })).toBe(
      'Offline — backup will resume when connected',
    );
  });

  it('distinguishes local and cloud changes', () => {
    expect(backupStatusLabel({ ...base, syncStatus: 'local_newer' })).toBe(
      'This device has changes not yet backed up',
    );
    expect(backupStatusLabel({ ...base, syncStatus: 'cloud_newer' })).toBe(
      'Cloud backup has newer records',
    );
  });

  it('only allows restore when an online cloud copy exists', () => {
    expect(canRestoreCloudBackup(true, 3)).toBe(true);
    expect(canRestoreCloudBackup(false, 3)).toBe(false);
    expect(canRestoreCloudBackup(true, 0)).toBe(false);
    expect(canRestoreCloudBackup(true, null)).toBe(false);
  });

  it('uses honest fallback copy for missing and invalid timestamps', () => {
    expect(formatBackupDate(null)).toBe('Never');
    expect(formatBackupDate('not-a-date')).toBe('Not available');
  });
});
