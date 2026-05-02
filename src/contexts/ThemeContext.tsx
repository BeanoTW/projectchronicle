import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'chronicle.theme';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const readStoredMode = (): ThemeMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
};

const applyTheme = (resolved: 'light' | 'dark') => {
  const root = document.documentElement;
  if (resolved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  // Listen to system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  // Apply class to <html>
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
