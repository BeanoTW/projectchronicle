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
  type SyncResult,
} from '@/local/syncEngine';
import { hydrateFromCloudOnce } from '@/local/hydration';
import { useToast } from '@/hooks/use-toast';

interface BackupContextType {
  backupEnabled: boolean;
  online: boolean;
  pendingCount: number;
  lastSyncAttemptAt: string | null;
  lastSyncResult: SyncResult | null;
  setBackupEnabled: (enabled: boolean) => Promise<void>;
  retrySyncNow: () => Promise<void>;
  deleteCloudData: () => Promise<{ incidents: number; notes: number }>;
  refreshDiagnostics: () => Promise<void>;
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
  const hydratedRef = useRef<string | null>(null);

  const refreshDiagnostics = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }
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
  }, [user]);

  // Load persisted toggle.
  useEffect(() => {
    isBackupEnabled().then(setBackupEnabledState);
  }, []);

  // Online/offline tracking.
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

  // On login: hydrate-from-cloud once, then refresh diagnostics.
  // Sync is only attempted when backup is ON.
  useEffect(() => {
    if (!user) return;
    if (hydratedRef.current === user.id) return;
    hydratedRef.current = user.id;
    (async () => {
      try {
        await hydrateFromCloudOnce(user.id);
      } catch {
        // hydration failure is non-fatal; local works regardless
      }
      await refreshDiagnostics();
      const enabled = await isBackupEnabled();
      if (enabled && (typeof navigator === 'undefined' || navigator.onLine)) {
        await syncNow(user.id);
        await refreshDiagnostics();
      }
    })();
  }, [user, refreshDiagnostics]);

  // Retry sync when connectivity returns (deterministic trigger #3).
  useEffect(() => {
    if (online && user && backupEnabled) {
      syncNow(user.id).then(() => refreshDiagnostics());
    }
  }, [online, user, backupEnabled, refreshDiagnostics]);

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
  }, [user, toast, refreshDiagnostics]);

  const retrySyncNow = useCallback(async () => {
    if (!user) return;
    await syncNow(user.id);
    await refreshDiagnostics();
  }, [user, refreshDiagnostics]);

  const deleteCloudData = useCallback(async () => {
    if (!user) return { incidents: 0, notes: 0 };
    const res = await deleteCloudCopy(user.id);
    await refreshDiagnostics();
    return res;
  }, [user, refreshDiagnostics]);

  return (
    <BackupContext.Provider value={{
      backupEnabled,
      online,
      pendingCount,
      lastSyncAttemptAt,
      lastSyncResult,
      setBackupEnabled,
      retrySyncNow,
      deleteCloudData,
      refreshDiagnostics,
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
