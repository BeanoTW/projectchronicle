import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useBackup } from '@/contexts/BackupContext';
import { useToast } from '@/hooks/use-toast';
import { localDB } from '@/local/db';
import AppSurface from '@/chronicle/shared/AppSurface';
import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';
import {
  SettingsRow,
  SettingsSection,
  SettingsToggle,
} from '@/chronicle/shared/SettingsView';
import {
  backupStatusLabel,
  canRestoreCloudBackup,
  formatBackupDate,
} from '@/lib/backup/backupRecovery';
import '@/chronicle/styles.css';

type Operation = 'backup' | 'restore' | 'delete-cloud' | 'toggle' | null;

const BackupRecoveryScreen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    backupEnabled,
    online,
    pendingCount,
    conflictCount,
    lastSyncAttemptAt,
    lastSyncResult,
    localCount,
    cloudCount,
    cloudLastUpdatedAt,
    lastBackupAt,
    lastRestoreAt,
    syncStatus,
    setBackupEnabled,
    backupNow,
    restoreFromCloud,
    deleteCloudData,
    refreshDiagnostics,
    refreshCloudCount,
    resolveConflictKeepLocal,
    resolveConflictKeepCloud,
  } = useBackup();

  const [operation, setOperation] = useState<Operation>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteCloudOpen, setDeleteCloudOpen] = useState(false);
  const [deleteCloudConfirm, setDeleteCloudConfirm] = useState('');
  const [conflictBusy, setConflictBusy] = useState<string | null>(null);

  const conflicts = useLiveQuery(
    async () => {
      if (!user) return [];
      return localDB.incidents
        .where('owner_user_id')
        .equals(user.id)
        .filter(record => record.sync_state === 'conflict')
        .toArray();
    },
    [user?.id, conflictCount],
    [],
  );

  useEffect(() => {
    void refreshDiagnostics();
    void refreshCloudCount();
  }, [refreshDiagnostics, refreshCloudCount]);

  const status = useMemo(
    () => backupStatusLabel({
      backupEnabled,
      online,
      pendingCount,
      conflictCount,
      syncStatus,
      lastBackupAt,
    }),
    [backupEnabled, online, pendingCount, conflictCount, syncStatus, lastBackupAt],
  );

  const handleBackupToggle = async (enabled: boolean) => {
    setOperation('toggle');
    try {
      await setBackupEnabled(enabled);
    } catch {
      toast({
        title: enabled ? 'Cloud backup could not be turned on' : 'Cloud backup could not be turned off',
        description: 'Your records have not been changed. Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setOperation(null);
    }
  };

  const handleBackupNow = async () => {
    setOperation('backup');
    try {
      await backupNow();
    } catch {
      toast({
        title: 'Backup could not be completed',
        description: 'Your records are still safe on this device. Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setOperation(null);
    }
  };

  const handleRestore = async () => {
    setOperation('restore');
    try {
      const result = await restoreFromCloud();
      setRestoreOpen(false);
      toast({
        title: 'Cloud backup restored',
        description: `${result.incidents} record${result.incidents === 1 ? '' : 's'} restored to this device.`,
      });
    } catch {
      toast({
        title: 'Restore could not be completed',
        description: 'Nothing was replaced. Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setOperation(null);
    }
  };

  const handleDeleteCloud = async () => {
    setOperation('delete-cloud');
    try {
      const result = await deleteCloudData();
      setDeleteCloudOpen(false);
      setDeleteCloudConfirm('');
      toast({
        title: 'Cloud copy deleted',
        description: `${result.incidents} backed-up record${result.incidents === 1 ? '' : 's'} removed. Records on this device are unchanged.`,
      });
    } catch {
      toast({
        title: 'Cloud copy could not be deleted',
        description: 'Nothing on this device was removed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setOperation(null);
    }
  };

  const handleConflict = async (incidentId: string, choice: 'local' | 'cloud') => {
    setConflictBusy(incidentId);
    try {
      if (choice === 'local') await resolveConflictKeepLocal(incidentId);
      else await resolveConflictKeepCloud(incidentId);
      toast({
        title: choice === 'local' ? 'This device copy kept' : 'Cloud copy restored',
        description: 'The conflict has been resolved.',
      });
    } catch {
      toast({
        title: 'Conflict could not be resolved',
        description: 'Both versions remain safe. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setConflictBusy(null);
    }
  };

  const restoreAvailable = canRestoreCloudBackup(online, cloudCount);
  const busy = operation !== null;

  return (
    <AppSurface>
      <div className="proto-page" data-testid="backup-recovery">
        <ChroniclePageHeader
          title="Backup & recovery"
          eyebrow="Record safety"
          subtitle="See what is protected, back up changes and recover records on this device."
        />

        <div className="proto-settings-grid">
          <SettingsSection title="Protection status">
            <SettingsRow label="Current status" value={status} />
            <SettingsRow
              label="This device"
              value={`${localCount} record${localCount === 1 ? '' : 's'}`}
              help={pendingCount > 0 ? `${pendingCount} waiting to back up.` : undefined}
            />
            <SettingsRow
              label="Cloud backup"
              value={
                cloudCount === null
                  ? online ? 'Unavailable' : 'Not checked while offline'
                  : `${cloudCount} record${cloudCount === 1 ? '' : 's'}`
              }
              help={cloudLastUpdatedAt ? `Latest cloud change: ${formatBackupDate(cloudLastUpdatedAt)}` : undefined}
            />
            <SettingsRow label="Last successful backup" value={formatBackupDate(lastBackupAt)} />
            <SettingsRow label="Last restore to this device" value={formatBackupDate(lastRestoreAt)} />
            <SettingsRow label="Connection" value={online ? 'Online' : 'Offline'} />
          </SettingsSection>

          <SettingsSection
            title="Cloud backup"
            description="Chronicle saves records on this device first. Cloud backup keeps an account-linked copy for recovery."
          >
            <SettingsToggle
              label="Automatic cloud backup"
              help="When on, Chronicle backs up after saves and when this device reconnects."
              checked={backupEnabled}
              disabled={!user || operation === 'toggle'}
              testId="backup-centre-toggle"
              onChange={value => { void handleBackupToggle(value); }}
            />
            <SettingsRow
              label="Back up now"
              help="Send records and follow-up notes that are not safely in your cloud copy yet."
              action={
                <button
                  type="button"
                  className="proto-btn"
                  data-variant="primary"
                  disabled={!user || !online || busy}
                  onClick={() => { void handleBackupNow(); }}
                  data-testid="backup-now"
                >
                  {operation === 'backup' ? 'Backing up…' : 'Back up now'}
                </button>
              }
            />
            {!online && (
              <p className="proto-set-error" role="status">
                You are offline. Your records remain on this device and backup will be available when you reconnect.
              </p>
            )}
            {lastSyncAttemptAt && lastSyncResult?.lastError && (
              <p className="proto-set-error" role="status">
                The latest backup attempt did not finish. No local records were removed.
              </p>
            )}
          </SettingsSection>

          {conflictCount > 0 && (
            <SettingsSection
              title="Records needing review"
              description="A record changed on this device and in the cloud. Chronicle will never choose a version for you."
            >
              {conflicts?.map(record => (
                <SettingsRow
                  key={record.id}
                  label={record.title || 'Untitled record'}
                  value={record.record_date || record.incident_date}
                  help="Choose which complete copy Chronicle should keep."
                  action={
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        className="proto-btn"
                        disabled={conflictBusy !== null}
                        onClick={() => { void handleConflict(record.id, 'local'); }}
                      >
                        Keep this device
                      </button>
                      <button
                        type="button"
                        className="proto-btn"
                        disabled={conflictBusy !== null || !online}
                        onClick={() => { void handleConflict(record.id, 'cloud'); }}
                      >
                        Keep cloud
                      </button>
                    </div>
                  }
                />
              ))}
            </SettingsSection>
          )}

          <SettingsSection
            title="Recover this device"
            description="Restore is for a replaced, reset or out-of-date device."
          >
            <SettingsRow
              label="Restore from cloud backup"
              help={
                cloudCount === 0
                  ? 'There is no cloud backup to restore.'
                  : 'This replaces Chronicle records on this device with the cloud copy. Local-only records will be removed.'
              }
              action={
                <button
                  type="button"
                  className="proto-btn"
                  disabled={!restoreAvailable || busy}
                  onClick={() => setRestoreOpen(true)}
                  data-testid="restore-from-cloud"
                >
                  Restore
                </button>
              }
            />
          </SettingsSection>

          <SettingsSection
            title="Cloud data controls"
            description="These controls affect the optional cloud copy, not the records currently held on this device."
          >
            <SettingsRow
              label="Delete backed-up records from cloud"
              help="Records and follow-up notes stay on this device. Attachments in Chronicle's private storage are not deleted."
              action={
                <button
                  type="button"
                  className="proto-btn proto-set-danger"
                  disabled={!online || cloudCount === null || cloudCount === 0 || busy}
                  onClick={() => { setDeleteCloudConfirm(''); setDeleteCloudOpen(true); }}
                  data-testid="delete-cloud-copy"
                >
                  Delete cloud copy
                </button>
              }
            />
          </SettingsSection>
        </div>
      </div>

      {restoreOpen && (
        <div className="proto-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="restore-cloud-title">
          <div className="proto-sheet">
            <div className="proto-sheet-head"><strong id="restore-cloud-title">Restore cloud backup?</strong></div>
            <div className="proto-sheet-body">
              <p className="proto-help">
                This will replace the Chronicle records and follow-up notes held on this device with your cloud copy.
                Any record saved only on this device will be removed. Your cloud copy will not be changed.
              </p>
              <SettingsRow
                label="Cloud records ready to restore"
                value={cloudCount === null ? 'Unavailable' : String(cloudCount)}
              />
            </div>
            <div className="proto-sheet-foot">
              <button type="button" className="proto-btn" disabled={operation === 'restore'} onClick={() => setRestoreOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="proto-btn proto-set-danger"
                disabled={operation === 'restore'}
                onClick={() => { void handleRestore(); }}
              >
                {operation === 'restore' ? 'Restoring…' : 'Replace this device copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCloudOpen && (
        <div className="proto-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-cloud-title">
          <div className="proto-sheet">
            <div className="proto-sheet-head"><strong id="delete-cloud-title">Delete the cloud copy?</strong></div>
            <div className="proto-sheet-body">
              <p className="proto-help">
                This permanently removes backed-up records and follow-up notes from your Chronicle cloud account.
                Records on this device remain here and return to local-only status. Type DELETE CLOUD to confirm.
              </p>
              <label className="proto-flabel" htmlFor="delete-cloud-confirm">Confirmation</label>
              <input
                id="delete-cloud-confirm"
                className="proto-input"
                value={deleteCloudConfirm}
                onChange={event => setDeleteCloudConfirm(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            <div className="proto-sheet-foot">
              <button type="button" className="proto-btn" disabled={operation === 'delete-cloud'} onClick={() => setDeleteCloudOpen(false)}>
                Keep cloud copy
              </button>
              <button
                type="button"
                className="proto-btn proto-set-danger"
                disabled={deleteCloudConfirm !== 'DELETE CLOUD' || operation === 'delete-cloud'}
                onClick={() => { void handleDeleteCloud(); }}
              >
                {operation === 'delete-cloud' ? 'Deleting…' : 'Delete cloud copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppSurface>
  );
};

export default BackupRecoveryScreen;
