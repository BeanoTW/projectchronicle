import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { isBackupEnabled, setBackupEnabled as persistBackupEnabled, localDB } from '@/local/db';
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
import { backupCanonicalOwner, type CanonicalBackupReport } from '@/chronicle/sync/canonicalBackup';
import { restoreCanonicalOwner } from '@/chronicle/sync/canonicalRestore';
import {
  getCanonicalCloudDiagnostics,
  getCanonicalLocalDiagnostics,
  setCanonicalBackupSucceeded,
  setCanonicalRestoreSucceeded,
} from '@/chronicle/sync/canonicalDiagnostics';
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
  canonicalAuthority: boolean;
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
const CANONICAL_DESTRUCTIVE_CONTROL_BLOCKED = 'This action is not available for canonical cloud backup yet. Chronicle will not guess how to resolve or delete a canonical cloud copy.';

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
  const [canonicalAuthority, setCanonicalAuthority] = useState(false);
  const [canonicalCloudBlocked, setCanonicalCloudBlocked] = useState(false);
  const hydratedRef = useRef<string | null>(null);
  const canonicalBackupRef = useRef<Promise<CanonicalBackupReport> | null>(null);

  const refreshAuthority = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setCanonicalAuthority(false);
      setCanonicalCloudBlocked(false);
      return false;
    }
    const active = !!(await getCanonicalActivation(user.id));
    setCanonicalAuthority(active);
    // #48/#49 provide the canonical backup/restore authority. The old guard is
    // retained in the API for older UI consumers, but it no longer blocks an
    // activated owner once this stacked cutover lands.
    setCanonicalCloudBlocked(false);
    return active;
  }, [user]);

  const runCanonicalBackup = useCallback(async (): Promise<CanonicalBackupReport> => {
    if (!user) return { records: 0, clarifications: 0, media: 0, appendOnlyRows: 0 };
    if (canonicalBackupRef.current) return canonicalBackupRef.current;
    const startedAt = new Date().toISOString();
    setLastAt(startedAt);
    canonicalBackupRef.current = (async () => {
      try {
        const report = await backupCanonicalOwner(user.id);
        const completedAt = new Date().toISOString();
        await setCanonicalBackupSucceeded(user.id, completedAt);
        const succeeded = report.records + report.clarifications + report.media + report.appendOnlyRows;
        setLastRes({ attempted: succeeded, succeeded, failed: 0, lastError: null });
        return report;
      } catch (error) {
        setLastRes({ attempted: 1, succeeded: 0, failed: 1, lastError: error instanceof Error ? error.message : 'Canonical backup failed.' });
        throw error;
      } finally {
        canonicalBackupRef.current = null;
      }
    })();
    return canonicalBackupRef.current;
  }, [user]);

  const refreshDiagnostics = useCallback(async () => {
    if (!user) {
      setPendingCount(0); setLocalCount(0); setConflictCount(0); setLastBackupAt(null); setLastRestoreAt(null); setLastAt(null); setLastRes(null);
      return;
    }
    const canonical = await refreshAuthority();
    if (canonical) {
      const diagnostics = await getCanonicalLocalDiagnostics(user.id);
      setLocalCount(diagnostics.localCount);
      setPendingCount(diagnostics.pendingCount);
      setConflictCount(diagnostics.conflictCount);
      setLastAt(previous => diagnostics.lastSyncAttemptAt ?? previous);
      setLastBackupAt(diagnostics.lastBackupAt);
      setLastRestoreAt(diagnostics.lastRestoreAt);
      return;
    }
    const total = await localDB.incidents.where('owner_user_id').equals(user.id).count();
    setLocalCount(total);
    const incidents = await localDB.incidents.where('owner_user_id').equals(user.id).filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed').count();
    const notes = await localDB.follow_up_notes.where('owner_user_id').equals(user.id).filter(r => r.sync_state === 'queued' || r.sync_state === 'backup_failed').count();
    setPendingCount(incidents + notes);
    setConflictCount(await getConflictCount(user.id));
    setLastAt(getLastSyncAttemptAt());
    setLastRes(getLastSyncResult());
    setLastBackupAt(await readLastBackupAt(user.id));
    setLastRestoreAt(await readLastRestoreAt(user.id));
  }, [user, refreshAuthority]);

  const refreshCloudCount = useCallback(async () => {
    if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setCloudCount(null); setCloudLastUpdatedAt(null); return;
    }
    const canonical = await refreshAuthority();
    if (canonical) {
      const diagnostics = await getCanonicalCloudDiagnostics(user.id);
      setCloudCount(diagnostics.cloudCount);
      setCloudLastUpdatedAt(diagnostics.cloudLastUpdatedAt);
      return;
    }
    const [c, t] = await Promise.all([getCloudCounts(), getCloudLastUpdatedAt()]);
    setCloudCount(c.incidents);
    setCloudLastUpdatedAt(t);
  }, [user, refreshAuthority]);

  useEffect(() => {
    if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    void refreshCloudCount();
  }, [user, online, refreshCloudCount]);

  useEffect(() => { void isBackupEnabled().then(setBackupEnabledState); }, []);

  useEffect(() => {
    const goOn = () => setOnline(true); const goOff = () => setOnline(false);
    window.addEventListener('online', goOn); window.addEventListener('offline', goOff);
    return () => { window.removeEventListener('online', goOn); window.removeEventListener('offline', goOff); };
  }, []);

  useEffect(() => {
    if (!user || hydratedRef.current === user.id) return;
    hydratedRef.current = user.id;
    void (async () => {
      const canonical = await refreshAuthority();
      if (canonical) {
        try {
          const count = await localDB.canonical_records.where('owner_id').equals(user.id).count();
          if (count === 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
            const restoredAt = new Date().toISOString();
            await restoreCanonicalOwner(user.id);
            await setCanonicalRestoreSucceeded(user.id, restoredAt);
          }
        } catch {
          // New-device hydration is non-destructive and non-fatal. A conflict or
          // unavailable cloud leaves the existing local canonical store intact.
        }
        await refreshDiagnostics();
        const enabled = await isBackupEnabled();
        if (enabled && (typeof navigator === 'undefined' || navigator.onLine)) {
          try { await runCanonicalBackup(); } catch { /* diagnostics expose failure */ }
        }
        await refreshDiagnostics();
        await refreshCloudCount();
        return;
      }
      try { await hydrateFromCloudOnce(user.id); } catch { /* legacy hydration failure is non-fatal */ }
      await refreshDiagnostics();
      const enabled = await isBackupEnabled();
      if (enabled && (typeof navigator === 'undefined' || navigator.onLine)) {
        await syncNow(user.id);
        await refreshDiagnostics();
        await refreshCloudCount();
      }
    })();
  }, [user, refreshAuthority, refreshDiagnostics, refreshCloudCount, runCanonicalBackup]);

  useEffect(() => {
    if (!online || !user || !backupEnabled) return;
    void (async () => {
      const canonical = await refreshAuthority();
      if (canonical) {
        try { await runCanonicalBackup(); } catch { /* reflected in diagnostics */ }
      } else {
        await syncNow(user.id);
      }
      await refreshDiagnostics();
      await refreshCloudCount();
    })();
  }, [online, user, backupEnabled, refreshAuthority, refreshDiagnostics, refreshCloudCount, runCanonicalBackup]);

  const setBackupEnabled = useCallback(async (enabled: boolean) => {
    await persistBackupEnabled(enabled);
    setBackupEnabledState(enabled);
    if (!user) return;
    const canonical = await refreshAuthority();
    if (enabled) {
      if (canonical) {
        toast({ title: 'Cloud backup enabled', description: 'Canonical records will be backed up without changing the copies on this device.' });
        if (typeof navigator === 'undefined' || navigator.onLine) await runCanonicalBackup();
      } else {
        await promoteAllLocalToQueued(user.id);
        toast({ title: 'Cloud backup enabled', description: 'Existing records have been queued for backup.' });
        if (typeof navigator === 'undefined' || navigator.onLine) await syncNow(user.id);
      }
    } else {
      if (!canonical) await demoteQueuedToLocalOnly(user.id);
      toast({ title: 'Cloud backup disabled', description: 'New changes will stay on this device. Existing cloud backup data is unchanged.' });
    }
    await refreshDiagnostics();
    await refreshCloudCount();
  }, [user, toast, refreshAuthority, runCanonicalBackup, refreshDiagnostics, refreshCloudCount]);

  const retrySyncNow = useCallback(async () => {
    if (!user) return;
    if (await refreshAuthority()) await runCanonicalBackup(); else await syncNow(user.id);
    await refreshDiagnostics(); await refreshCloudCount();
  }, [user, refreshAuthority, runCanonicalBackup, refreshDiagnostics, refreshCloudCount]);

  const backupNow = useCallback(async () => {
    if (!user) return;
    if (await refreshAuthority()) {
      const report = await runCanonicalBackup();
      await refreshDiagnostics(); await refreshCloudCount();
      const total = report.records + report.clarifications + report.media + report.appendOnlyRows;
      toast({ title: 'Backup complete', description: `${total} canonical item${total === 1 ? '' : 's'} checked and protected in your cloud account.` });
      return;
    }
    await promoteAllLocalToQueued(user.id);
    const res = await syncNow(user.id, { force: true });
    await refreshDiagnostics(); await refreshCloudCount();
    if (res.failed > 0) toast({ title: 'Backup completed with errors', description: `${res.succeeded} uploaded, ${res.failed} failed.`, variant: 'destructive' });
    else toast({ title: 'Backup complete', description: `${res.succeeded} record(s) uploaded to your cloud account.` });
  }, [user, toast, refreshAuthority, runCanonicalBackup, refreshDiagnostics, refreshCloudCount]);

  const restoreFromCloud = useCallback(async () => {
    if (!user) return { incidents: 0, notes: 0 };
    if (await refreshAuthority()) {
      const report = await restoreCanonicalOwner(user.id);
      await setCanonicalRestoreSucceeded(user.id, new Date().toISOString());
      await refreshDiagnostics(); await refreshCloudCount();
      return { incidents: report.recordsAdded, notes: 0 };
    }
    const res = await restoreFromCloudEngine(user.id);
    await refreshDiagnostics(); await refreshCloudCount();
    return res;
  }, [user, refreshAuthority, refreshDiagnostics, refreshCloudCount]);

  const deleteCloudData = useCallback(async () => {
    if (!user) return { incidents: 0, notes: 0 };
    if (await refreshAuthority()) throw new Error(CANONICAL_DESTRUCTIVE_CONTROL_BLOCKED);
    const res = await deleteCloudCopy(user.id);
    await refreshDiagnostics(); await refreshCloudCount();
    return res;
  }, [user, refreshAuthority, refreshDiagnostics, refreshCloudCount]);

  const resolveConflictKeepLocal = useCallback(async (incidentId: string) => {
    if (await refreshAuthority()) throw new Error(CANONICAL_DESTRUCTIVE_CONTROL_BLOCKED);
    await engineKeepLocal(incidentId);
    if (user) await syncNow(user.id);
    await refreshDiagnostics(); await refreshCloudCount();
  }, [user, refreshAuthority, refreshDiagnostics, refreshCloudCount]);

  const resolveConflictKeepCloud = useCallback(async (incidentId: string) => {
    if (await refreshAuthority()) throw new Error(CANONICAL_DESTRUCTIVE_CONTROL_BLOCKED);
    await engineKeepCloud(incidentId);
    await refreshDiagnostics(); await refreshCloudCount();
  }, [refreshAuthority, refreshDiagnostics, refreshCloudCount]);

  let syncStatus: SyncStatus = 'unknown';
  if (canonicalCloudBlocked) syncStatus = 'canonical_cloud_unavailable';
  else if (cloudCount === null) syncStatus = (typeof navigator !== 'undefined' && !navigator.onLine) ? 'unknown' : 'cloud_unavailable';
  else if (cloudCount === 0) syncStatus = localCount > 0 ? 'local_only' : 'in_sync';
  else if (localCount === cloudCount && pendingCount === 0) {
    if (cloudLastUpdatedAt && lastBackupAt) {
      const cloudT = new Date(cloudLastUpdatedAt).getTime(); const localT = new Date(lastBackupAt).getTime();
      if (Math.abs(cloudT - localT) < 60_000) syncStatus = 'in_sync';
      else if (cloudT > localT) syncStatus = 'cloud_newer';
      else syncStatus = 'local_newer';
    } else syncStatus = lastBackupAt ? 'in_sync' : 'unknown';
  } else if (localCount > cloudCount || pendingCount > 0) syncStatus = 'local_newer';
  else syncStatus = 'cloud_newer';

  return (
    <BackupContext.Provider value={{
      backupEnabled, online, pendingCount, conflictCount, lastSyncAttemptAt, lastSyncResult,
      localCount, cloudCount, cloudLastUpdatedAt, lastBackupAt, lastRestoreAt, syncStatus,
      canonicalAuthority, canonicalCloudBlocked, setBackupEnabled, retrySyncNow, backupNow,
      restoreFromCloud, deleteCloudData, refreshDiagnostics, refreshCloudCount,
      resolveConflictKeepLocal, resolveConflictKeepCloud,
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
