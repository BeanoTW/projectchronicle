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
import { getCanonicalActivation } from '@/chronicle/model/canonicalActivation';
import { useToast } from '@/hooks/use-toast';

export type SyncStatus = 'in_sync' | 'local_newer' | 'cloud_newer' | 'cloud_unavailable' | 'local_only' | 'canonical_cloud_unavailable' | 'unknown';

interface BackupContextType {
  backupEnabled: boolean;
  online: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAttemptAt: string | null;
  lastSyncResult: SyncResult | null;
  localCount: number;
  cloudCount: number | null;
  cloudLastUpdatedAt: string | null;
  lastBackupAt: string | null;
  lastRestoreAt: string | null;
  syncStatus: SyncStatus;
  canonicalCloudBlocked: boolean;
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
const CANONICAL_CLOUD_UNAVAILABLE = 'Cloud backup for canonical records is not enabled yet. Your records remain safe on this device.';

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
  const [canonicalCloudBlocked, setCanonicalCloudBlocked] = useState(false);
  const hydratedRef = useRef<string | null>(null);

  const refreshAuthority = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setCanonicalCloudBlocked(false);
      return false;
    }
    const active = !!(await getCanonicalActivation(user.id));
    setCanonicalCloudBlocked(active);
    return active;
  }, [user]);

  const refreshDiagnostics = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      setLocalCount(0);
      setConflictCount(0);
      setLastBackupAt(null);
      setLastRestoreAt(null);
      return;
    }
    const canonical = await refreshAuthority();
    if (canonical) {
      setLocalCount(await localDB.canonical_records.where('owner_id').equals(user.id).count());
      setPendingCount(0);
      setConflictCount(0);
      setLastAt(null);
      setLastRes(null);
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
  }, [user, refreshAuthority]);

  const refreshCloudCount = useCallback(async () => {
    if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setCloudCount(null);
      setCloudLastUpdatedAt(null);
      return;
    }
    const canonical = await refreshAuthority();
    if (canonical) {
      setCloudCount(null);
      setCloudLastUpdatedAt(null);
      return;
    }
    const [c, t] = await Promise.all([getCloudCounts(), getCloudLastUpdatedAt()]);
    setCloudCount(c.incidents);
    setCloudLastUpdatedAt(t);
  }, [user, refreshAuthority]);

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
      const canonical = await refreshAuthority();
      if (canonical) {
        await refreshDiagnostics();
        return;
      }
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
  }, [user, refreshAuthority, refreshDiagnostics, refreshCloudCount]);

  useEffect(() => {
    if (online && user && backupEnabled && !canonicalCloudBlocked) {
      syncNow(user.id).then(() => {
        refreshDiagnostics();
        refreshCloudCount();
      });
    }
  }, [online, user, backupEnabled, canonicalCloudBlocked, refreshDiagnostics, refreshCloudCount]);

  const assertLegacyCloudAuthority = useCallback(async () => {
    if (await refreshAuthority()) throw new Error(CANONICAL_CLOUD_UNAVAILABLE);
  }, [refreshAuthority]);

  const setBackupEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) await assertLegacyCloudAuthority();
    await persistBackupEnabled(enabled);
    setBackupEnabledState(enabled);
    if (!user) return;
    if (enabled) {
      await promoteAllLocalToQueued(user.id);
      toast({ title: 'Cloud backup enabled', description: 'Existing records have been queued for backup.' });
      if (typeof navigator === 'undefined' || navigator.onLine) await syncNow(user.id);
    } else {
      if (!canonicalCloudBlocked) await demoteQueuedToLocalOnly(user.id);
      toast({
        title: 'Cloud backup disabled',
        description: canonicalCloudBlocked
          ? 'Canonical records remain on this device. Any older legacy cloud copy is unchanged.'
          : 'New records will not be uploaded. Previously backed-up records remain in your cloud account until you delete them.',
      });
    }
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [user, toast, refreshDiagnostics, refreshCloudCount, assertLegacyCloudAuthority, canonicalCloudBlocked]);

  const retrySyncNow = useCallback(async () => {
    if (!user) return;
    await assertLegacyCloudAuthority();
    await syncNow(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [user, refreshDiagnostics, refreshCloudCount, assertLegacyCloudAuthority]);

  const backupNow = useCallback(async () => {
    if (!user) return;
    await assertLegacyCloudAuthority();
    await promoteAllLocalToQueued(user.id);
    const res = await syncNow(user.id, { force: true });
    await refreshDiagnostics();
    await refreshCloudCount();
    if (res.failed > 0) {
      toast({ title: 'Backup completed with errors', description: `${res.succeeded} uploaded, ${res.failed} failed.`, variant: 'destructive' });
    } else {
      toast({ title: 'Backup complete', description: `${res.succeeded} record(s) uploaded to your cloud account.` });
    }
  }, [user, toast, refreshDiagnostics, refreshCloudCount, assertLegacyCloudAuthority]);

  const restoreFromCloud = useCallback(async () => {
    if (!user) return { incidents: 0, notes: 0 };
    await assertLegacyCloudAuthority();
    const res = await restoreFromCloudEngine(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
    return res;
  }, [user, refreshDiagnostics, refreshCloudCount, assertLegacyCloudAuthority]);

  const deleteCloudData = useCallback(async () => {
    if (!user) return { incidents: 0, notes: 0 };
    await assertLegacyCloudAuthority();
    const res = await deleteCloudCopy(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
    return res;
  }, [user, refreshDiagnostics, refreshCloudCount, assertLegacyCloudAuthority]);

  const resolveConflictKeepLocal = useCallback(async (incidentId: string) => {
    await assertLegacyCloudAuthority();
    await engineKeepLocal(incidentId);
    if (user) await syncNow(user.id);
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [user, refreshDiagnostics, refreshCloudCount, assertLegacyCloudAuthority]);

  const resolveConflictKeepCloud = useCallback(async (incidentId: string) => {
    await assertLegacyCloudAuthority();
    await engineKeepCloud(incidentId);
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [refreshDiagnostics, refreshCloudCount, assertLegacyCloudAuthority]);

  let syncStatus: SyncStatus = 'unknown';
  if (canonicalCloudBlocked) {
    syncStatus = 'canonical_cloud_unavailable';
  } else if (cloudCount === null) {
    syncStatus = (typeof navigator !== 'undefined' && !navigator.onLine) ? 'unknown' : 'cloud_unavailable';
  } else if (cloudCount === 0) {
    syncStatus = localCount > 0 ? 'local_only' : 'in_sync';
  } else if (localCount === cloudCount && pendingCount === 0) {
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
      canonicalCloudBlocked,
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
