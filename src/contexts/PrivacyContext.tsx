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

interface EntityContext {
  people_involved?: string[] | null;
  witnesses?: string[] | null;
}

interface PrivacyContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Mask a free-text value (narrative, quote, location, name). */
  maskText: (value: string | null | undefined, opts?: { preview?: boolean }) => string;
  /**
   * Lightweight inline masking — replaces ONLY known names from the supplied
   * context within the text. Preserves sentence structure. Never replaces the
   * full string. Use for titles and short previews where readability matters.
   */
  maskEntities: (value: string | null | undefined, context?: EntityContext | null) => string;
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
    // Mask a single token (name-like): keep first letter, replace the rest with bullets.
    const maskToken = (tok: string): string => {
      const t = tok.trim();
      if (!t) return tok;
      const first = t.charAt(0);
      return `${first}${'•'.repeat(Math.max(2, Math.min(6, t.length - 1)))}`;
    };

    /**
     * maskText — used on OVERVIEW surfaces (titles, previews, location, short
     * meta). Performs partial inline masking only:
     *   - detected proper-noun tokens (Capitalised words, 2+ chars) are masked
     *   - the rest of the sentence remains readable
     * NEVER converts the whole string to dots. For full-narrative blocks on
     * detail surfaces, use the visual <ObscuredBlock> component instead.
     */
    const maskText: PrivacyContextValue['maskText'] = (value, opts) => {
      if (!enabled) return value ?? '';
      if (!value) return '';
      if (opts?.preview) return value; // previews stay readable; entities are masked elsewhere
      // Mask capitalised tokens (likely names / proper nouns), skipping sentence starts where possible.
      // We accept some false positives — privacy bias is intentional on overview surfaces.
      return value.replace(/\b([A-Z][a-zA-Z'’\-]{1,})\b/g, (_m, tok: string) => maskToken(tok));
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

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const maskEntities: PrivacyContextValue['maskEntities'] = (value, context) => {
      if (!enabled) return value ?? '';
      if (!value) return '';
      const names = [
        ...(context?.people_involved ?? []),
        ...(context?.witnesses ?? []),
      ]
        .map((n) => (n || '').trim())
        .filter((n) => n.length >= 2)
        // Longest first so "Alex Smith" matches before "Alex".
        .sort((a, b) => b.length - a.length);
      if (names.length === 0) return value;
      let out = value;
      for (const name of names) {
        const replacement = maskName(name);
        try {
          const re = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
          out = out.replace(re, replacement);
        } catch {
          /* ignore bad regex */
        }
      }
      return out;
    };

    return { enabled, setEnabled, maskText, maskEntities, maskName, maskNames, maskFilename };
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
      maskEntities: (v) => v ?? '',
      maskName: (v) => v ?? '',
      maskNames: (v) => v ?? [],
      maskFilename: (v) => v ?? '',
    };
  }
  return ctx;
}
