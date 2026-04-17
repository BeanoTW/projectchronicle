import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDevMode } from '@/contexts/DevModeContext';
import { useBackup } from '@/contexts/BackupContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

const AuthDebugPanel = () => {
  const { devMode } = useDevMode();
  const { user, session, loading } = useAuth();
  const { backupEnabled, online, pendingCount, lastSyncAttemptAt, lastSyncResult, retrySyncNow } = useBackup();
  const location = useLocation();
  const [lastEvent, setLastEvent] = useState<string>('none');
  const [localAvailable, setLocalAvailable] = useState<string>('unknown');

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

  const hash = window.location.hash;
  const hashParams = new URLSearchParams(hash.substring(1));

  return (
    <div className="fixed bottom-20 left-2 right-2 max-w-lg mx-auto bg-card border border-border rounded-lg p-3 z-50 text-[10px] font-mono shadow-lg max-h-[60vh] overflow-y-auto">
      <p className="text-[11px] font-semibold text-foreground mb-2">Auth + Storage Debug</p>
      <div className="space-y-0.5 text-muted-foreground">
        <p>Route: <span className="text-foreground">{location.pathname}</span></p>
        <p>Flow type: <span className="text-foreground">{hashParams.get('type') || 'n/a'}</span></p>
        <p>Session: <span className="text-foreground">{loading ? 'loading' : session ? 'active' : 'none'}</span></p>
        <p>User: <span className="text-foreground">{user?.email || 'none'}</span></p>
        <p>Confirmed: <span className="text-foreground">{user?.email_confirmed_at ? 'yes' : 'no'}</span></p>
        <p>Last auth event: <span className="text-foreground">{lastEvent}</span></p>
        <div className="border-t border-border my-1.5" />
        <p>Backup toggle: <span className="text-foreground">{backupEnabled ? 'ON' : 'OFF'}</span></p>
        <p>Network: <span className="text-foreground">{online ? 'online' : 'offline'}</span></p>
        <p>Local storage available: <span className="text-foreground">{localAvailable}</span></p>
        <p>Pending backup: <span className="text-foreground">{pendingCount}</span></p>
        <p>Last sync attempt: <span className="text-foreground">{lastSyncAttemptAt ?? 'never'}</span></p>
        <p>Last sync result: <span className="text-foreground">{lastSyncResult ? `${lastSyncResult.succeeded}/${lastSyncResult.attempted} ok, ${lastSyncResult.failed} failed` : 'n/a'}</span></p>
        <p>Last sync error: <span className="text-foreground">{lastSyncResult?.lastError ?? 'none'}</span></p>
        <button
          onClick={() => retrySyncNow()}
          className="mt-1.5 text-[10px] text-primary underline disabled:opacity-50"
          disabled={!backupEnabled || !online}
        >
          Force sync now
        </button>
      </div>
    </div>
  );
};

export default AuthDebugPanel;
