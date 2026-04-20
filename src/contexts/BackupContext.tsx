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
  type SyncResult,
} from '@/local/syncEngine';
import { hydrateFromCloudOnce } from '@/local/hydration';
import { useToast } from '@/hooks/use-toast';

export type SyncStatus = 'in_sync' | 'local_newer' | 'cloud_newer' | 'cloud_unavailable' | 'local_only' | 'unknown';

interface BackupContextType {
  backupEnabled: boolean;
  online: boolean;
  pendingCount: number;
  lastSyncAttemptAt: string | null;
  lastSyncResult: SyncResult | null;
  // New: dataset state
  localCount: number;
  cloudCount: number | null;
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
}

const BackupContext = createContext<BackupContextType | undefined>(undefined);

export const BackupProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [backupEnabled, setBackupEnabledState] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAttemptAt, setLastAt] = useState<string | null>(null);
  const [lastSyncResult, setLastRes] = useState<SyncResult | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
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
    setLastAt(getLastSyncAttemptAt());
    setLastRes(getLastSyncResult());
    setLastBackupAt(await readLastBackupAt(user.id));
    setLastRestoreAt(await readLastRestoreAt(user.id));
  }, [user]);

  const refreshCloudCount = useCallback(async () => {
    if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setCloudCount(null);
      return;
    }
    const c = await getCloudCounts();
    setCloudCount(c.incidents);
  }, [user]);

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
    const res = await syncNow(user.id);
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

  // Derived sync status (incident counts + last backup timestamp).
  let syncStatus: SyncStatus = 'unknown';
  if (cloudCount === null) {
    syncStatus = backupEnabled ? 'cloud_unavailable' : 'unknown';
  } else if (localCount === cloudCount && pendingCount === 0) {
    syncStatus = 'in_sync';
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
      lastSyncAttemptAt,
      lastSyncResult,
      localCount,
      cloudCount,
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
