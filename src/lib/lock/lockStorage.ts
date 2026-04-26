/**
 * Typed wrappers over localStorage for App Lock state.
 *
 * All keys are namespaced per user id: `chronicle.lock.<userId>.<field>`.
 * Nothing here is ever synced or written to IndexedDB / Supabase.
 */

import type { PinHashRecord } from './pinCrypto';

const PREFIX = 'chronicle.lock';

export const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
export const ALLOWED_TIMEOUTS_MS = [60_000, 5 * 60_000, 15 * 60_000] as const;

function key(userId: string, field: string): string {
  return `${PREFIX}.${userId}.${field}`;
}

function read<T>(userId: string, field: string): T | null {
  try {
    const raw = localStorage.getItem(key(userId, field));
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(userId: string, field: string, value: unknown): void {
  try {
    localStorage.setItem(key(userId, field), JSON.stringify(value));
  } catch {
    /* quota or disabled storage — fail silently */
  }
}

function remove(userId: string, field: string): void {
  try {
    localStorage.removeItem(key(userId, field));
  } catch {
    /* noop */
  }
}

// PIN hash
export const getPinHash = (uid: string) => read<PinHashRecord>(uid, 'pinHash');
export const setPinHash = (uid: string, h: PinHashRecord) => write(uid, 'pinHash', h);
export const clearPinHash = (uid: string) => remove(uid, 'pinHash');

// Biometric
export const getBiometricCredentialId = (uid: string) => read<string>(uid, 'webauthnCredentialId');
export const setBiometricCredentialId = (uid: string, id: string) => write(uid, 'webauthnCredentialId', id);
export const clearBiometricCredentialId = (uid: string) => remove(uid, 'webauthnCredentialId');

// Timeout
export const getLockTimeoutMs = (uid: string): number => {
  const v = read<number>(uid, 'lockTimeoutMs');
  return typeof v === 'number' && ALLOWED_TIMEOUTS_MS.includes(v as 60_000) ? v : DEFAULT_LOCK_TIMEOUT_MS;
};
export const setLockTimeoutMs = (uid: string, ms: number) => write(uid, 'lockTimeoutMs', ms);

// Failed attempts / lockout
export const getFailedAttempts = (uid: string): number => read<number>(uid, 'failedAttempts') ?? 0;
export const setFailedAttempts = (uid: string, n: number) => write(uid, 'failedAttempts', n);
export const clearFailedAttempts = (uid: string) => remove(uid, 'failedAttempts');

export const getLockoutUntil = (uid: string): number | null => read<number>(uid, 'lockoutUntil');
export const setLockoutUntil = (uid: string, ts: number) => write(uid, 'lockoutUntil', ts);
export const clearLockoutUntil = (uid: string) => remove(uid, 'lockoutUntil');

// Last unlocked at — drives focus-based re-lock decisions
export const getLastUnlockedAt = (uid: string): number | null => read<number>(uid, 'lastUnlockedAt');
export const setLastUnlockedAt = (uid: string, ts: number) => write(uid, 'lastUnlockedAt', ts);
export const clearLastUnlockedAt = (uid: string) => remove(uid, 'lastUnlockedAt');

/** Wipe all lock state for a user (used when removing the lock entirely). */
export function clearAllLockState(uid: string): void {
  clearPinHash(uid);
  clearBiometricCredentialId(uid);
  clearFailedAttempts(uid);
  clearLockoutUntil(uid);
  clearLastUnlockedAt(uid);
  remove(uid, 'lockTimeoutMs');
}

/** Compute lockout cooldown for the n-th failed attempt (1-indexed). */
export function cooldownForFailures(failures: number): number {
  // 5 wrong → 30s, then doubles each subsequent failure, capped at 15 min.
  if (failures < 5) return 0;
  const overshoot = failures - 5;
  const ms = 30_000 * Math.pow(2, overshoot);
  return Math.min(ms, 15 * 60_000);
}
