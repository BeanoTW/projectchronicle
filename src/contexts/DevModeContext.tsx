import { createContext, useContext, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DevModeContextType {
  devMode: boolean;
  toggleDevMode: () => void;
}

const DevModeContext = createContext<DevModeContextType>({ devMode: false, toggleDevMode: () => {} });

export const DevModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [devMode, setDevMode] = useState(false);
  const { toast } = useToast();

  const toggleDevMode = useCallback(() => {
    setDevMode(prev => {
      const next = !prev;
      toast({
        title: next ? 'Developer mode enabled' : 'Developer mode disabled',
        description: next ? 'Full delete and reset controls are now available.' : 'Returned to normal mode.',
      });
      return next;
    });
  }, [toast]);

  return (
    <DevModeContext.Provider value={{ devMode, toggleDevMode }}>
      {children}
    </DevModeContext.Provider>
  );
};

export const useDevMode = () => useContext(DevModeContext);
