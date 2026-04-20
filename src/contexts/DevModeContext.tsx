import { createContext, useContext, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
// Add tester emails here to grant access in production builds.
const DEV_ALLOWLIST = [
  'project.chronicle88@gmail.com',
  'beanotarren@gmail.com',
];

const isDevEnvironment = import.meta.env.DEV === true;

export const DevModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [devMode, setDevMode] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const email = user?.email?.toLowerCase() ?? null;
  const isDevUser = !!email && DEV_ALLOWLIST.map(e => e.toLowerCase()).includes(email);
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

  return (
    <DevModeContext.Provider value={{ devMode: effectiveDevMode, toggleDevMode, canAccessDevPanel }}>
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevMode = () => useContext(DevModeContext);
