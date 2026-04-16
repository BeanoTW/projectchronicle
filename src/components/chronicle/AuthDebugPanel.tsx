import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDevMode } from '@/contexts/DevModeContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

const AuthDebugPanel = () => {
  const { devMode } = useDevMode();
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const [lastEvent, setLastEvent] = useState<string>('none');
  const [lastError, setLastError] = useState<string>('none');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      setLastEvent(event);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!devMode) return null;

  const hash = window.location.hash;
  const hashParams = new URLSearchParams(hash.substring(1));

  return (
    <div className="fixed bottom-20 left-2 right-2 max-w-lg mx-auto bg-card border border-border rounded-lg p-3 z-50 text-[10px] font-mono shadow-lg">
      <p className="text-[11px] font-semibold text-foreground mb-2">Auth Debug</p>
      <div className="space-y-0.5 text-muted-foreground">
        <p>Route: <span className="text-foreground">{location.pathname}</span></p>
        <p>Flow type: <span className="text-foreground">{hashParams.get('type') || 'n/a'}</span></p>
        <p>URL hash: <span className="text-foreground">{hash ? hash.substring(0, 60) + (hash.length > 60 ? '…' : '') : 'none'}</span></p>
        <p>Session: <span className="text-foreground">{loading ? 'loading' : session ? 'active' : 'none'}</span></p>
        <p>User: <span className="text-foreground">{user?.email || 'none'}</span></p>
        <p>Confirmed: <span className="text-foreground">{user?.email_confirmed_at ? 'yes' : 'no'}</span></p>
        <p>Last event: <span className="text-foreground">{lastEvent}</span></p>
        <p>Last error: <span className="text-foreground">{lastError}</span></p>
      </div>
    </div>
  );
};

export default AuthDebugPanel;
