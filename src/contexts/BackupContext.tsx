import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  isBackupEnabled,
  setBackupEnabled as persistBackupEnabled,
  localDB,
} from '@/local/db';
import {
  syncNow,
  promoteAllLocalToQueued,
  demoteQueuedToLocalOnly,
  deleteCloudCopy,
  getLastSyncResult,
  getLastSyncAttemptAt,
  getCloudCounts,
  getCloudLastUpdatedAt,
  restoreFromCloud as restoreFromCloudEngine,
  getLastBackupAt as readLastBackupAt,
  getLastRestoreAt as readLastRestoreAt,
  getConflictCount,
  resolveConflictKeepLocal as engineKeepLocal,
  resolveConflictKeepCloud as engineKeepCloud,
  type SyncResult,
} from '@/local/syncEngine';
import { hydrateFromCloudOnce } from '@/local/hydration';
import { useToast } from '@/hooks/use-toast';

export type SyncStatus = 'in_sync' | 'local_newer' | 'cloud_newer' | 'cloud_unavailable' | 'local_only' | 'unknown';

interface BackupContextType {
  backupEnabled: boolean;
  online: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAttemptAt: string | null;
  lastSyncResult: SyncResult | null;
  // New: dataset state
  localCount: number;
  cloudCount: number | null;
  cloudLastUpdatedAt: string | null;
  lastBackupAt: string | null;
  lastRestoreAt: string | null;
  syncStatus: SyncStatus;
  setBackupEnabled: (enabled: boolean) => Promise<void>;
  retrySyncNow: () => Promise<void>;
  backupNow: () => Promise<void>;
  restoreFromCloud: () => Promise<{ incidents: number; notes: number }>;
  deleteCloudData: () => Promise<{ incidents: number; notes: number }>;
  refreshDiagnostics: () => Promise<void>;
  refreshCloudCount: () => Promise<void>;
  resolveConflictKeepLocal: (incidentId: string) => Promise<void>;
  resolveConflictKeepCloud: (incidentId: string) => Promise<void>;
}

const BackupContext = createContext<BackupContextType | undefined>(undefined);

export const BackupProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [backupEnabled, setBackupEnabledState] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [lastSyncAttemptAt, setLastAt] = useState<string | null>(null);
  const [lastSyncResult, setLastRes] = useState<SyncResult | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [cloudLastUpdatedAt, setCloudLastUpdatedAt] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastRestoreAt, setLastRestoreAt] = useState<string | null>(null);
  const hydratedRef = useRef<string | null>(null);

  const refreshDiagnostics = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      setLocalCount(0);
      setLastBackupAt(null);
      setLastRestoreAt(null);
      return;
    }
    const total = await localDB.incidents.where('owner_user_id').equals(user.id).count();
    setLocalCount(total);
    const incidents = await localDB.incidents
      .where('owner_user_id').equals(user.id)
      .filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed')
      .count();
    const notes = await localDB.follow_up_notes
      .where('owner_user_id').equals(user.id)
      .filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed')
      .count();
    setPendingCount(incidents + notes);
    setConflictCount(await getConflictCount(user.id));
    setLastAt(getLastSyncAttemptAt());
    setLastRes(getLastSyncResult());
    setLastBackupAt(await readLastBackupAt(user.id));
    setLastRestoreAt(await readLastRestoreAt(user.id));
  }, [user]);

  const refreshCloudCount = useCallback(async () => {
    if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setCloudCount(null);
      setCloudLastUpdatedAt(null);
      return;
    }
    const [c, t] = await Promise.all([getCloudCounts(), getCloudLastUpdatedAt()]);
    setCloudCount(c.incidents);
    setCloudLastUpdatedAt(t);
  }, [user]);

  // Always-on cloud visibility: fetch cloud snapshot on user/online change,
  // independent of the backup toggle. Read-only — never modifies local data.
  useEffect(() => {
    if (!user) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    refreshCloudCount();
  }, [user, online, refreshCloudCount]);

  useEffect(() => {
    isBackupEnabled().then(setBackupEnabledState);
  }, []);

  useEffect(() => {
    const goOn = () => setOnline(true);
    const goOff = () => setOnline(false);
    window.addEventListener('online', goOn);
    window.addEventListener('offline', goOff);
    return () => {
      window.removeEventListener('online', goOn);
      window.removeEventListener('offline', goOff);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (hydratedRef.current === user.id) return;
    hydratedRef.current = user.id;
    (async () => {
      try {
        await hydrateFromCloudOnce(user.id);
      } catch {
        // hydration failure is non-fatal
      }
      await refreshDiagnostics();
      const enabled = await isBackupEnabled();
      if (enabled && (typeof navigator === 'undefined' || navigator.onLine)) {
        await syncNow(user.id);
        await refreshDiagnostics();
        await refreshCloudCount();
      }
    })();
  }, [user, refreshDiagnostics, refreshCloudCount]);

  useEffect(() => {
    if (online && user && backupEnabled) {
      syncNow(user.id).then(() => {
        refreshDiagnostics();
        refreshCloudCount();
      });
    }
  }, [online, user, backupEnabled, refreshDiagnostics, refreshCloudCount]);

  const setBackupEnabled = useCallback(async (enabled: boolean) => {
    await persistBackupEnabled(enabled);
    setBackupEnabledState(enabled);
    if (!user) return;
    if (enabled) {
      await promoteAllLocalToQueued(user.id);
      toast({ title: 'Cloud backup enabled', description: 'Existing records have been queued for backup.' });
      if (typeof navigator === 'undefined' || navigator.onLine) {
        await syncNow(user.id);
      }
    } else {
      await demoteQueuedToLocalOnly(user.id);
      toast({
        title: 'Cloud backup disabled',
        description: 'New records will not be uploaded. Previously backed-up records remain in your cloud account until you delete them.',
      });
    }
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [user, toast, refreshDiagnostics, refreshCloudCount]);

  const retrySyncNow = useCallback(async () => {
    if (!user) return;
    await syncNow(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [user, refreshDiagnostics, refreshCloudCount]);

  const backupNow = useCallback(async () => {
    if (!user) return;
    // One-shot push: queue any local-only records, then sync.
    await promoteAllLocalToQueued(user.id);
    const res = await syncNow(user.id, { force: true });
    await refreshDiagnostics();
    await refreshCloudCount();
    if (res.failed > 0) {
      toast({ title: 'Backup completed with errors', description: `${res.succeeded} uploaded, ${res.failed} failed.`, variant: 'destructive' });
    } else {
      toast({ title: 'Backup complete', description: `${res.succeeded} record(s) uploaded to your cloud account.` });
    }
  }, [user, toast, refreshDiagnostics, refreshCloudCount]);

  const restoreFromCloud = useCallback(async () => {
    if (!user) return { incidents: 0, notes: 0 };
    const res = await restoreFromCloudEngine(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
    return res;
  }, [user, refreshDiagnostics, refreshCloudCount]);

  const deleteCloudData = useCallback(async () => {
    if (!user) return { incidents: 0, notes: 0 };
    const res = await deleteCloudCopy(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
    return res;
  }, [user, refreshDiagnostics, refreshCloudCount]);

  const resolveConflictKeepLocal = useCallback(async (incidentId: string) => {
    await engineKeepLocal(incidentId);
    if (user) await syncNow(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [user, refreshDiagnostics, refreshCloudCount]);

  const resolveConflictKeepCloud = useCallback(async (incidentId: string) => {
    await engineKeepCloud(incidentId);
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [refreshDiagnostics, refreshCloudCount]);

  // Derived sync status. Uses incident counts and the most recent updated_at on
  // each side as a coarse "newer than" signal. No automatic sync is implied —
  // this is purely a label so users can decide whether to Backup or Restore.
  let syncStatus: SyncStatus = 'unknown';
  if (cloudCount === null) {
    // Online but failed → unavailable; offline → unknown.
    syncStatus = (typeof navigator !== 'undefined' && !navigator.onLine) ? 'unknown' : 'cloud_unavailable';
  } else if (cloudCount === 0) {
    syncStatus = localCount > 0 ? 'local_only' : 'in_sync';
  } else if (localCount === cloudCount && pendingCount === 0) {
    // If we have a cloud timestamp and a last backup timestamp, prefer the
    // newer one; otherwise count parity is enough to call it "in sync".
    if (cloudLastUpdatedAt && lastBackupAt) {
      const cloudT = new Date(cloudLastUpdatedAt).getTime();
      const localT = new Date(lastBackupAt).getTime();
      if (Math.abs(cloudT - localT) < 60_000) syncStatus = 'in_sync';
      else if (cloudT > localT) syncStatus = 'cloud_newer';
      else syncStatus = 'local_newer';
    } else {
      syncStatus = 'in_sync';
    }
  } else if (localCount > cloudCount || pendingCount > 0) {
    syncStatus = 'local_newer';
  } else {
    syncStatus = 'cloud_newer';
  }

  return (
    <BackupContext.Provider value={{
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
      retrySyncNow,
      backupNow,
      restoreFromCloud,
      deleteCloudData,
      refreshDiagnostics,
      refreshCloudCount,
      resolveConflictKeepLocal,
      resolveConflictKeepCloud,
    }}>
      {children}
    </BackupContext.Provider>
  );
};

export const useBackup = () => {
  const ctx = useContext(BackupContext);
  if (!ctx) throw new Error('useBackup must be used within BackupProvider');
  return ctx;
};
