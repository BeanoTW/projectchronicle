import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics/analytics';

interface DevModeContextType {
  devMode: boolean;
  toggleDevMode: () => void;
  canAccessDevPanel: boolean;
}

const DevModeContext = createContext<DevModeContextType>({
  devMode: false,
  toggleDevMode: () => {},
  canAccessDevPanel: false,
});

// Explicit allowlist — do NOT use role-based access for the dev panel.
//
// Addresses are stored as SHA-256 hashes of the lowercased email so the
// production bundle does not publish real personal email addresses. This is
// obscurity, not authorisation: the panel exposes no data the signed-in user
// cannot already see, and every privileged action stays behind RLS.
const DEV_ALLOWLIST_HASHES = new Set([
  // project.chronicle88@gmail.com
  '53b3447fc60f1ec5057151bceca08a31463ff6750946409c80ce92dd37acd8f7',
  // beanotarren@gmail.com
  '8aba9fe0f2d1725d2b02734755fecf74461dbf71270519efdcee23947b41f1a8',
]);

const sha256Hex = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const isDevEnvironment = import.meta.env.DEV === true;

export const DevModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [devMode, setDevMode] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [isDevUser, setIsDevUser] = useState(false);

  const email = user?.email?.trim().toLowerCase() ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!email) { setIsDevUser(false); return; }
    sha256Hex(email)
      .then(hash => { if (!cancelled) setIsDevUser(DEV_ALLOWLIST_HASHES.has(hash)); })
      .catch(() => { if (!cancelled) setIsDevUser(false); });
    return () => { cancelled = true; };
  }, [email]);

  const canAccessDevPanel = isDevEnvironment || isDevUser;

  const toggleDevMode = useCallback(() => {
    // Hard gate: silently no-op for users without explicit access.
    // No toast, no UI hint — production users must not be able to discover it.
    if (!canAccessDevPanel) return;

    setDevMode(prev => {
      const next = !prev;
      toast({
        title: next ? 'Developer mode enabled' : 'Developer mode disabled',
        description: next ? 'Full delete and reset controls are now available.' : 'Returned to normal mode.',
      });
      return next;
    });
  }, [toast, canAccessDevPanel]);

  // Defensive: if the active user loses access (e.g. account switch),
  // make sure dev mode does not remain enabled.
  const effectiveDevMode = canAccessDevPanel ? devMode : false;

  // Keep analytics suppression in sync with developer status.
  // Suppress whenever the current account is a developer account OR Developer
  // Mode is active OR we're already in a dev/preview environment (auto-detected
  // inside analytics at module load).
  useEffect(() => {
    if (isDevUser || effectiveDevMode) {
      analytics.setSuppressed(true, isDevUser ? 'dev-account' : 'dev-mode');
    } else if (!analytics.suppressionReason()?.match(/dev-build|localhost|preview-host/)) {
      // Only re-enable when no environment-level suppression is in force.
      analytics.setSuppressed(false);
    }
  }, [isDevUser, effectiveDevMode]);

  return (
    <DevModeContext.Provider value={{ devMode: effectiveDevMode, toggleDevMode, canAccessDevPanel }}>
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevMode = () => useContext(DevModeContext);
