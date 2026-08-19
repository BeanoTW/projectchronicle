// Reusable contextual-guidance model.
//
// One system, many screens: a screen supplies steps, the runtime handles
// spotlighting, positioning, progression, accessibility and completion state.
//
// Guidance state is UI-only. It is stored in localStorage, scoped per account,
// and never touches records, sealing, Chronicle membership, sync or backups.

export interface GuidanceStep {
  /** Stable id — used for keys and for the progress announcement. */
  id: string;
  title: string;
  body: string;
  /**
   * Candidate CSS selectors, most specific first. The first one that resolves
   * to a *visible* element becomes the spotlight target. If none resolve the
   * step is shown as a centred card rather than pointing at nothing.
   */
  targets?: string[];
  /** Preferred side; the runtime overrides it when there is no room. */
  prefer?: 'top' | 'bottom';
}

export type GuidanceEndReason = 'done' | 'skipped';

/* ------------------------------------------------------------------ *
 * Completion state
 * ------------------------------------------------------------------ */

export type GuidanceFlag = 'app_intro_completed' | 'chronicle_intro_completed';

const key = (flag: GuidanceFlag, userId: string | null | undefined) =>
  `chronicle.guidance.${flag}.${userId ?? 'device'}`;

const safeGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode / storage full — guidance simply reappears next session */
  }
};

const safeRemove = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* no-op */
  }
};

export const isGuidanceComplete = (flag: GuidanceFlag, userId: string | null | undefined) =>
  safeGet(key(flag, userId)) === '1';

export const markGuidanceComplete = (flag: GuidanceFlag, userId: string | null | undefined) =>
  safeSet(key(flag, userId), '1');

export const resetGuidance = (flag: GuidanceFlag, userId: string | null | undefined) =>
  safeRemove(key(flag, userId));

/* ------------------------------------------------------------------ *
 * New account detection
 * ------------------------------------------------------------------ */

/**
 * Guidance shipped on this date. Any account created before it is, by
 * definition, an established account and must never be shown the first-use
 * introduction just because the feature now exists.
 */
export const GUIDANCE_RELEASED_AT = Date.UTC(2026, 7, 19);

/** A recently created account with nothing recorded yet. */
export const isNewAccount = (
  createdAt: string | null | undefined,
  recordCount: number,
): boolean => {
  if (recordCount > 0) return false;
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;
  if (created < GUIDANCE_RELEASED_AT) return false;
  // Guard against an old account that happens to be empty.
  return Date.now() - created < 30 * 24 * 60 * 60 * 1000;
};
