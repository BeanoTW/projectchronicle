// Phase 9 — user-scoped transient state cleanup.
//
// Canonical user data is never touched here. This module only clears
// *transient* per-account UI state so that signing out, or a different account
// signing in on the same device, can never expose the previous user's draft
// text or in-memory screen state.
//
// Feature flags are deliberately NOT cleared: they are device-local
// configuration and contain no user information.

import { productionDraftKey } from './captureModel';

/** All capture drafts share this prefix (`chronicle.capture.draft:<userId>`). */
export const CAPTURE_DRAFT_PREFIX = 'chronicle.capture.draft:';

const LAST_USER_KEY = 'chronicle.lastUserId';

type Reset = () => void;
const transientResets = new Set<Reset>();

/** Screens register module-level UI state so it can be reset on account change. */
export const registerTransientReset = (fn: Reset): (() => void) => {
  transientResets.add(fn);
  return () => { transientResets.delete(fn); };
};

const safeSession = (): Storage | null => {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
};

const safeLocal = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** Removes every capture draft belonging to any account on this device. */
export const clearCaptureDrafts = (): void => {
  const s = safeSession();
  if (!s) return;
  const keys: string[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const k = s.key(i);
    if (k && k.startsWith(CAPTURE_DRAFT_PREFIX)) keys.push(k);
  }
  keys.forEach(k => { try { s.removeItem(k); } catch { /* ignore */ } });
};

/** Removes the draft for one specific account only. */
export const clearCaptureDraftFor = (userId: string | null | undefined): void => {
  const s = safeSession();
  if (!s) return;
  try { s.removeItem(productionDraftKey(userId)); } catch { /* ignore */ }
};

/**
 * Clears all user-specific transient state. Called on sign out and whenever a
 * different account becomes active on this device.
 */
export const clearUserScopedState = (): void => {
  clearCaptureDrafts();
  transientResets.forEach(fn => { try { fn(); } catch { /* ignore */ } });
};

/**
 * Records which account is active. When the account changes (including
 * signed-in → signed-out → other account) transient state is cleared.
 * Returns true when a clear happened.
 */
export const syncActiveUser = (userId: string | null | undefined): boolean => {
  const l = safeLocal();
  const next = userId ?? '';
  let previous = '';
  try { previous = l?.getItem(LAST_USER_KEY) ?? ''; } catch { /* ignore */ }

  // Nothing known yet, or the same account — just record it.
  if (previous === next) return false;

  const changedAccount = previous !== '' && next !== '' && previous !== next;
  try { l?.setItem(LAST_USER_KEY, next); } catch { /* ignore */ }

  if (changedAccount) {
    clearUserScopedState();
    return true;
  }
  return false;
};

export const getLastActiveUser = (): string | null => {
  try { return safeLocal()?.getItem(LAST_USER_KEY) || null; } catch { return null; }
};
