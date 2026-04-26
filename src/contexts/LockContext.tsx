/**
 * App Lock context.
 *
 * Owns: whether the app is currently locked, whether a lock is configured,
 * unlock methods (PIN + biometric), and re-lock-on-focus behaviour.
 *
 * Storage and crypto live entirely on the device — see lib/lock/*.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { hashPin, verifyPin, isValidPinFormat } from '@/lib/lock/pinCrypto';
import {
  registerBiometric, verifyBiometric, isPlatformAuthenticatorAvailable,
} from '@/lib/lock/webauthn';
import {
  getPinHash, setPinHash, clearPinHash,
  getBiometricCredentialId, setBiometricCredentialId, clearBiometricCredentialId,
  getLockTimeoutMs, setLockTimeoutMs,
  getFailedAttempts, setFailedAttempts, clearFailedAttempts,
  getLockoutUntil, setLockoutUntil, clearLockoutUntil,
  getLastUnlockedAt, setLastUnlockedAt, clearLastUnlockedAt,
  clearAllLockState, cooldownForFailures, DEFAULT_LOCK_TIMEOUT_MS,
} from '@/lib/lock/lockStorage';

interface LockContextValue {
  isLocked: boolean;
  isLockConfigured: boolean;
  biometricSupported: boolean;
  biometricEnabled: boolean;
  lockTimeoutMs: number;
  attemptsRemaining: number; // attempts before next cooldown kicks in (5 then doubled)
  lockoutUntil: number | null;
  unlockWithPin: (pin: string) => Promise<{ ok: boolean; reason: 'wrong' | 'locked_out' | 'no_pin' | null }>;
  unlockWithBiometric: () => Promise<{ ok: boolean; reason: 'cancelled' | 'unavailable' | 'no_credential' | null }>;
  lockNow: () => void;
  setPin: (pin: string) => Promise<void>;
  removeLock: () => void;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => void;
  setTimeout: (ms: number) => void;
  /** Bypass the lock screen after the user re-authed with their account password. */
  markRecoveryUnlock: () => void;
}

const LockContext = createContext<LockContextValue | undefined>(undefined);

const FAILURE_WINDOW = 5; // attempts before first cooldown

export const LockProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Lock state
  const [isLocked, setIsLocked] = useState(true);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [lockTimeoutMs, setLockTimeoutMsState] = useState<number>(DEFAULT_LOCK_TIMEOUT_MS);
  const [failedAttempts, setFailedAttemptsState] = useState(0);
  const [lockoutUntil, setLockoutUntilState] = useState<number | null>(null);

  const hiddenSinceRef = useRef<number | null>(null);

  // Hydrate per-user state whenever the user changes.
  useEffect(() => {
    if (!userId) {
      setIsLocked(true);
      setPinConfigured(false);
      setBiometricEnabled(false);
      setFailedAttemptsState(0);
      setLockoutUntilState(null);
      return;
    }
    const hash = getPinHash(userId);
    const credId = getBiometricCredentialId(userId);
    const timeout = getLockTimeoutMs(userId);
    const fa = getFailedAttempts(userId);
    const lu = getLockoutUntil(userId);
    setPinConfigured(!!hash);
    setBiometricEnabled(!!credId);
    setLockTimeoutMsState(timeout);
    setFailedAttemptsState(fa);
    setLockoutUntilState(lu);
    // Always start locked on user change / cold start when a lock is configured.
    setIsLocked(!!hash);
  }, [userId]);

  // Detect biometric platform support once.
  useEffect(() => {
    let cancelled = false;
    isPlatformAuthenticatorAvailable().then(ok => {
      if (!cancelled) setBiometricSupported(ok);
    });
    return () => { cancelled = true; };
  }, []);

  // Re-lock on focus / visibility change after the configured timeout.
  useEffect(() => {
    if (!userId || !pinConfigured) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const since = hiddenSinceRef.current;
        hiddenSinceRef.current = null;
        const lastUnlock = getLastUnlockedAt(userId) ?? 0;
        const elapsed = Date.now() - lastUnlock;
        const hiddenFor = since != null ? Date.now() - since : 0;
        if (elapsed >= lockTimeoutMs || hiddenFor >= lockTimeoutMs) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [userId, pinConfigured, lockTimeoutMs]);

  const isLockConfigured = pinConfigured;
  const effectiveLocked = isLockConfigured && isLocked;

  const attemptsRemaining = Math.max(0, FAILURE_WINDOW - (failedAttempts % FAILURE_WINDOW));

  const recordSuccess = useCallback(() => {
    if (!userId) return;
    clearFailedAttempts(userId);
    clearLockoutUntil(userId);
    setLastUnlockedAt(userId, Date.now());
    setFailedAttemptsState(0);
    setLockoutUntilState(null);
    setIsLocked(false);
  }, [userId]);

  const recordFailure = useCallback(() => {
    if (!userId) return;
    const next = failedAttempts + 1;
    setFailedAttempts(userId, next);
    setFailedAttemptsState(next);
    const cooldown = cooldownForFailures(next);
    if (cooldown > 0) {
      const until = Date.now() + cooldown;
      setLockoutUntil(userId, until);
      setLockoutUntilState(until);
    }
  }, [userId, failedAttempts]);

  const unlockWithPin: LockContextValue['unlockWithPin'] = useCallback(async (pin) => {
    if (!userId) return { ok: false, reason: 'no_pin' };
    if (lockoutUntil && Date.now() < lockoutUntil) return { ok: false, reason: 'locked_out' };
    const record = getPinHash(userId);
    if (!record) return { ok: false, reason: 'no_pin' };
    const ok = await verifyPin(pin, record);
    if (ok) {
      recordSuccess();
      return { ok: true, reason: null };
    }
    recordFailure();
    return { ok: false, reason: 'wrong' };
  }, [userId, lockoutUntil, recordSuccess, recordFailure]);

  const unlockWithBiometric: LockContextValue['unlockWithBiometric'] = useCallback(async () => {
    if (!userId) return { ok: false, reason: 'no_credential' };
    const credId = getBiometricCredentialId(userId);
    if (!credId) return { ok: false, reason: 'no_credential' };
    if (!biometricSupported) return { ok: false, reason: 'unavailable' };
    try {
      const ok = await verifyBiometric(credId);
      if (ok) {
        recordSuccess();
        return { ok: true, reason: null };
      }
      return { ok: false, reason: 'cancelled' };
    } catch {
      return { ok: false, reason: 'cancelled' };
    }
  }, [userId, biometricSupported, recordSuccess]);

  const lockNow = useCallback(() => {
    if (userId) clearLastUnlockedAt(userId);
    setIsLocked(true);
  }, [userId]);

  const setPin = useCallback(async (pin: string) => {
    if (!userId) throw new Error('Not signed in');
    if (!isValidPinFormat(pin)) throw new Error('PIN must be 4–6 digits');
    const record = await hashPin(pin);
    setPinHash(userId, record);
    clearFailedAttempts(userId);
    clearLockoutUntil(userId);
    setFailedAttemptsState(0);
    setLockoutUntilState(null);
    setPinConfigured(true);
    // Setting/changing the PIN counts as proof of presence — leave unlocked.
    setLastUnlockedAt(userId, Date.now());
    setIsLocked(false);
  }, [userId]);

  const removeLock = useCallback(() => {
    if (!userId) return;
    clearAllLockState(userId);
    setPinConfigured(false);
    setBiometricEnabled(false);
    setFailedAttemptsState(0);
    setLockoutUntilState(null);
    setLockTimeoutMsState(DEFAULT_LOCK_TIMEOUT_MS);
    setIsLocked(false);
  }, [userId]);

  const enableBiometric = useCallback(async () => {
    if (!userId || !user?.email) throw new Error('Not signed in');
    if (!biometricSupported) throw new Error('Biometric not supported on this device');
    const credId = await registerBiometric(userId, user.email);
    setBiometricCredentialId(userId, credId);
    setBiometricEnabled(true);
  }, [userId, user?.email, biometricSupported]);

  const disableBiometric = useCallback(() => {
    if (!userId) return;
    clearBiometricCredentialId(userId);
    setBiometricEnabled(false);
  }, [userId]);

  const setTimeout = useCallback((ms: number) => {
    if (!userId) return;
    setLockTimeoutMs(userId, ms);
    setLockTimeoutMsState(ms);
  }, [userId]);

  const markRecoveryUnlock = useCallback(() => {
    if (!userId) return;
    clearFailedAttempts(userId);
    clearLockoutUntil(userId);
    setLastUnlockedAt(userId, Date.now());
    setFailedAttemptsState(0);
    setLockoutUntilState(null);
    setIsLocked(false);
  }, [userId]);

  const value = useMemo<LockContextValue>(() => ({
    isLocked: effectiveLocked,
    isLockConfigured,
    biometricSupported,
    biometricEnabled,
    lockTimeoutMs,
    attemptsRemaining,
    lockoutUntil,
    unlockWithPin,
    unlockWithBiometric,
    lockNow,
    setPin,
    removeLock,
    enableBiometric,
    disableBiometric,
    setTimeout,
    markRecoveryUnlock,
  }), [
    effectiveLocked, isLockConfigured, biometricSupported, biometricEnabled, lockTimeoutMs,
    attemptsRemaining, lockoutUntil, unlockWithPin, unlockWithBiometric, lockNow, setPin,
    removeLock, enableBiometric, disableBiometric, setTimeout, markRecoveryUnlock,
  ]);

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
};

export const useLock = (): LockContextValue => {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
};
