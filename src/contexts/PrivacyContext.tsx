/**
 * PrivacyContext — UI-only Privacy Shield.
 *
 * Provides a global toggle that masks identifying content in the UI.
 * Stored data and exports are NEVER affected. There is no encryption
 * implied — this is a display filter only.
 *
 * What is masked when active:
 *   - names (people involved, witnesses, names referenced in narrative)
 *   - locations
 *   - quotes / exact words
 *   - raw narrative / account text
 *   - identifying evidence file names
 *
 * What is NEVER masked:
 *   - dates, times
 *   - record type (Incident / Daily record)
 *   - categories / subtypes
 *   - counts and layout
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'chronicle-privacy-shield';

interface PrivacyContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Mask a free-text value (narrative, quote, location, name). */
  maskText: (value: string | null | undefined, opts?: { preview?: boolean }) => string;
  /** Mask a person's name. */
  maskName: (name: string | null | undefined) => string;
  /** Mask an array of names → returns masked names joined for display. */
  maskNames: (names: string[] | null | undefined) => string[];
  /** Mask a filename, preserving extension only. */
  maskFilename: (name: string | null | undefined) => string;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const PrivacyProvider = ({ children }: { children: React.ReactNode }) => {
  const [enabled, setEnabledState] = useState<boolean>(() => readInitial());

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      if (v) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabledState(e.newValue === '1');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<PrivacyContextValue>(() => {
    const maskText: PrivacyContextValue['maskText'] = (value, opts) => {
      if (!enabled) return value ?? '';
      if (!value) return '';
      // Show length-based redaction. For previews, keep something compact.
      if (opts?.preview) return '••••••••';
      // Replace word characters with bullets, preserve whitespace + basic punctuation rhythm.
      return value.replace(/\S/g, '•');
    };

    const maskName: PrivacyContextValue['maskName'] = (name) => {
      if (!enabled) return name ?? '';
      if (!name) return '';
      const trimmed = name.trim();
      if (!trimmed) return '';
      // Preserve initial only: "Alex Smith" → "A•••••"
      const first = trimmed.charAt(0).toUpperCase();
      return `${first}${'•'.repeat(Math.max(2, Math.min(6, trimmed.length - 1)))}`;
    };

    const maskNames: PrivacyContextValue['maskNames'] = (names) => {
      if (!names) return [];
      if (!enabled) return names;
      return names.map((n) => maskName(n));
    };

    const maskFilename: PrivacyContextValue['maskFilename'] = (name) => {
      if (!enabled) return name ?? '';
      if (!name) return '';
      const dot = name.lastIndexOf('.');
      const ext = dot > 0 && dot < name.length - 1 ? name.slice(dot) : '';
      return `••••••${ext}`;
    };

    return { enabled, setEnabled, maskText, maskName, maskNames, maskFilename };
  }, [enabled, setEnabled]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
};

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    // Safe fallback: privacy off, identity-pass-through. Avoids hard crash if
    // a component renders outside the provider during HMR.
    return {
      enabled: false,
      setEnabled: () => {},
      maskText: (v) => v ?? '',
      maskName: (v) => v ?? '',
      maskNames: (v) => v ?? [],
      maskFilename: (v) => v ?? '',
    };
  }
  return ctx;
}
