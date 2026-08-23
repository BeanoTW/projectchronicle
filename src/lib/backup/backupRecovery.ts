import type { SyncStatus } from '@/contexts/BackupContext';

export interface BackupStatusInput {
  backupEnabled: boolean;
  online: boolean;
  pendingCount: number;
  conflictCount: number;
  syncStatus: SyncStatus;
  lastBackupAt: string | null;
}

export const backupStatusLabel = ({
  backupEnabled,
  online,
  pendingCount,
  conflictCount,
  syncStatus,
  lastBackupAt,
}: BackupStatusInput): string => {
  if (conflictCount > 0) {
    return `${conflictCount} record${conflictCount === 1 ? '' : 's'} need review`;
  }
  if (!online) {
    return backupEnabled ? 'Offline — backup will resume when connected' : 'Offline';
  }
  if (pendingCount > 0) {
    return `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to back up`;
  }
  if (!backupEnabled && !lastBackupAt) return 'Cloud backup is off';
  if (syncStatus === 'cloud_unavailable') return 'Cloud status is unavailable';
  if (syncStatus === 'cloud_newer') return 'Cloud backup has newer records';
  if (syncStatus === 'local_newer') return 'This device has changes not yet backed up';
  if (syncStatus === 'in_sync') return 'This device and cloud backup are in sync';
  return lastBackupAt ? 'Backed up earlier' : 'Backup status not checked yet';
};

export const canRestoreCloudBackup = (
  online: boolean,
  cloudCount: number | null,
): boolean => online && cloudCount !== null && cloudCount > 0;

export const formatBackupDate = (value: string | null): string => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};
