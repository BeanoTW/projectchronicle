import { useState, useEffect } from 'react';
import { ChevronUp, Minus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDevMode } from '@/contexts/DevModeContext';
import { useBackup } from '@/contexts/BackupContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import DevAnalyticsPanel from './DevAnalyticsPanel';

type PanelState = 'expanded' | 'collapsed' | 'closed';
const STORAGE_KEY = 'chronicle.devPanel.state';

const AuthDebugPanel = () => {
  const { devMode, toggleDevMode } = useDevMode();
  const { user, session, loading } = useAuth();
  const { backupEnabled, online, pendingCount, lastSyncAttemptAt, lastSyncResult, retrySyncNow, localCount, cloudCount, syncStatus, lastBackupAt, lastRestoreAt, refreshCloudCount } = useBackup();
  const location = useLocation();
  const [lastEvent, setLastEvent] = useState<string>('none');
  const [localAvailable, setLocalAvailable] = useState<string>('unknown');
  const [panelState, setPanelState] = useState<PanelState>(() => {
    if (typeof window === 'undefined') return 'collapsed';
    const stored = sessionStorage.getItem(STORAGE_KEY) as PanelState | null;
    return stored ?? 'collapsed';
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, panelState);
  }, [panelState]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      setLastEvent(event);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const probe = indexedDB.open('chronicle_local');
      probe.onsuccess = () => { setLocalAvailable('yes'); probe.result.close(); };
      probe.onerror = () => setLocalAvailable('no');
    } catch {
      setLocalAvailable('no');
    }
  }, []);

  if (!devMode) return null;
  if (panelState === 'closed') return null;

  const hash = window.location.hash;
  const hashParams = new URLSearchParams(hash.substring(1));
  const storageMode = backupEnabled ? 'Cloud' : 'Local';
  const syncMode = backupEnabled ? (online ? 'Sync On' : 'Offline') : 'Sync Off';
  const syncLabel =
    syncStatus === 'in_sync' ? 'in sync' :
    syncStatus === 'local_newer' ? 'local newer' :
    syncStatus === 'cloud_newer' ? 'cloud newer' :
    syncStatus === 'local_only' ? 'local only' :
    syncStatus === 'cloud_unavailable' ? 'cloud n/a' : 'unknown';
  const authMode = loading ? 'loading' : session ? 'active' : 'none';

  const handleClose = () => {
    setPanelState('closed');
    // Also exit dev mode entirely so the user fully removes it from screen
    toggleDevMode();
  };

  if (panelState === 'collapsed') {
    return (
      <div className="fixed bottom-20 left-2 z-50 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-1 bg-card border border-border rounded-full pl-2.5 pr-1 py-1 shadow-lg text-[10px] font-mono">
          <button
            onClick={() => setPanelState('expanded')}
            className="flex items-center gap-1.5 text-foreground"
            aria-label="Expand developer panel"
          >
            <span className="font-semibold text-primary">DEV</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground">L:{localCount}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground">C:{cloudCount === null ? '—' : cloudCount}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground">{storageMode}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground">{syncLabel}</span>
            <ChevronUp className="h-3 w-3 text-muted-foreground ml-0.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/40"
            aria-label="Close developer panel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-2 right-2 max-w-lg mx-auto bg-card border border-border rounded-lg z-50 text-[10px] font-mono shadow-lg max-h-[60vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <p className="text-[11px] font-semibold text-foreground">Auth + Storage Debug</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPanelState('collapsed')}
            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted/40"
            aria-label="Minimise"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted/40"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto p-3 space-y-0.5 text-muted-foreground">
        <p>Route: <span className="text-foreground">{location.pathname}</span></p>
        <p>Flow type: <span className="text-foreground">{hashParams.get('type') || 'n/a'}</span></p>
        <p>Session: <span className="text-foreground">{authMode}</span></p>
        <p>User: <span className="text-foreground">{user?.email || 'none'}</span></p>
        <p>Confirmed: <span className="text-foreground">{user?.email_confirmed_at ? 'yes' : 'no'}</span></p>
        <p>Last auth event: <span className="text-foreground">{lastEvent}</span></p>
        <div className="border-t border-border my-1.5" />
        <p>Backup toggle: <span className="text-foreground">{backupEnabled ? 'ON' : 'OFF'}</span></p>
        <p>Network: <span className="text-foreground">{online ? 'online' : 'offline'}</span></p>
        <p>Local storage available: <span className="text-foreground">{localAvailable}</span></p>
        <p>Local records: <span className="text-foreground tabular-nums">{localCount}</span></p>
        <p>Cloud records: <span className="text-foreground tabular-nums">{cloudCount === null ? 'unavailable' : cloudCount}</span></p>
        <p>Sync status: <span className="text-foreground">{syncLabel}</span></p>
        <p>Last backup: <span className="text-foreground">{lastBackupAt ?? 'never'}</span></p>
        <p>Last restore: <span className="text-foreground">{lastRestoreAt ?? 'never'}</span></p>
        <p>Pending backup: <span className="text-foreground">{pendingCount}</span></p>
        <p>Last sync attempt: <span className="text-foreground">{lastSyncAttemptAt ?? 'never'}</span></p>
        <p>Last sync result: <span className="text-foreground">{lastSyncResult ? `${lastSyncResult.succeeded}/${lastSyncResult.attempted} ok, ${lastSyncResult.failed} failed` : 'n/a'}</span></p>
        <p>Last sync error: <span className="text-foreground">{lastSyncResult?.lastError ?? 'none'}</span></p>
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={() => retrySyncNow()}
            className="text-[10px] text-primary underline disabled:opacity-50"
            disabled={!backupEnabled || !online}
          >
            Force sync now
          </button>
          <button
            onClick={() => refreshCloudCount()}
            className="text-[10px] text-primary underline disabled:opacity-50"
            disabled={!online}
          >
            Refresh cloud count
          </button>
        </div>
        <div className="border-t border-border my-2" />
        <DevAnalyticsPanel />
      </div>
    </div>
  );
};

export default AuthDebugPanel;
