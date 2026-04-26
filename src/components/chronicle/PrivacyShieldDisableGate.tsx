/**
 * PrivacyShieldDisableGate — confirms the user before turning Privacy Shield OFF.
 *
 * Turning Privacy Shield ON is immediate (no gate).
 * Turning it OFF requires confirmation:
 *   - If App Lock is configured → PIN (or biometric if available).
 *   - If App Lock is NOT configured → account password re-auth, OR an
 *     option to set up App Lock with a PIN instead.
 *
 * On success → onConfirmed() is called (parent then disables Privacy Shield).
 * On cancel/failure → onCancel() is called and Privacy Shield stays ON.
 *
 * No password is stored or logged.
 */
import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Fingerprint, Lock, KeyRound } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useLock } from '@/contexts/LockContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isValidPinFormat } from '@/lib/lock/pinCrypto';

type Mode = 'choose' | 'pin' | 'password' | 'setup-pin';

interface Props {
  open: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
}

const PrivacyShieldDisableGate = ({ open, onConfirmed, onCancel }: Props) => {
  const lock = useLock();
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>('choose');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const biometricAttemptedRef = useRef(false);

  // Initialise mode whenever opened.
  useEffect(() => {
    if (!open) {
      biometricAttemptedRef.current = false;
      return;
    }
    setPin('');
    setPassword('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
    setBusy(false);
    setBioBusy(false);

    if (lock.isLockConfigured) {
      setMode('pin');
      if (
        lock.biometricEnabled && lock.biometricSupported &&
        !biometricAttemptedRef.current
      ) {
        biometricAttemptedRef.current = true;
        void tryBiometric();
      } else {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      setMode('choose');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tryBiometric = async () => {
    setBioBusy(true);
    setError(null);
    try {
      const res = await lock.unlockWithBiometric();
      if (res.ok) { onConfirmed(); return; }
      if (res.reason && res.reason !== 'cancelled' && res.reason !== 'no_credential') {
        setError('Biometric unavailable. Enter your PIN to continue.');
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setBioBusy(false);
    }
  };

  const submitPin = async () => {
    if (!pin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await lock.unlockWithPin(pin);
      if (res.ok) { onConfirmed(); return; }
      if (res.reason === 'locked_out') {
        setError('Too many attempts. Try again shortly.');
      } else {
        setError('Incorrect PIN. Privacy Shield remains on.');
      }
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    if (!password || !user?.email) return;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (authError) {
        setError('Password could not be confirmed. Privacy Shield remains on.');
        setPassword('');
        return;
      }
      setPassword('');
      onConfirmed();
    } catch {
      setError('Password could not be confirmed. Privacy Shield remains on.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const submitSetupPin = async () => {
    if (!isValidPinFormat(newPin)) { setError('PIN must be 4–6 digits.'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return; }
    setBusy(true);
    setError(null);
    try {
      await lock.setPin(newPin);
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set PIN.');
    } finally {
      setBusy(false);
    }
  };

  // ── Mode: choose (no App Lock configured) ─────────────────────────────
  if (mode === 'choose') {
    return (
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Confirm before turning off Privacy Shield
            </AlertDialogTitle>
            <AlertDialogDescription>
              Privacy Shield is hiding sensitive information on this device.
              To turn it off, confirm it is you using your account password,
              or set up App Lock with a PIN for quicker access next time.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Button
              type="button"
              variant="default"
              className="w-full justify-start h-auto py-2.5"
              onClick={() => { setMode('password'); setError(null); setTimeout(() => inputRef.current?.focus(), 50); }}
            >
              <KeyRound className="h-4 w-4 mr-2 shrink-0" />
              Use account password
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start h-auto py-2.5"
              onClick={() => { setMode('setup-pin'); setError(null); setTimeout(() => inputRef.current?.focus(), 50); }}
            >
              <Lock className="h-4 w-4 mr-2 shrink-0" />
              Set up PIN
            </Button>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ── Mode: PIN (App Lock configured) ───────────────────────────────────
  if (mode === 'pin') {
    return (
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Confirm to turn off Privacy Shield
            </AlertDialogTitle>
            <AlertDialogDescription>
              Privacy Shield is hiding sensitive information on this device.
              Confirm it is you to turn it off.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            {lock.biometricEnabled && lock.biometricSupported && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
                disabled={bioBusy || busy}
                onClick={() => { void tryBiometric(); }}
              >
                <Fingerprint className="h-4 w-4 mr-2" />
                {bioBusy ? 'Waiting for biometric…' : 'Use biometric'}
              </Button>
            )}
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">PIN</label>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                disabled={busy || bioBusy}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submitPin(); } }}
                placeholder="••••"
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-[14px] tracking-[0.4em] text-center"
              />
              {error && <p className="text-[12px] text-destructive">{error}</p>}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy || bioBusy} onClick={onCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || bioBusy || !pin}
              onClick={(e) => { e.preventDefault(); void submitPin(); }}
            >
              {busy ? 'Checking…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ── Mode: account password ────────────────────────────────────────────
  if (mode === 'password') {
    return (
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Confirm with account password
            </AlertDialogTitle>
            <AlertDialogDescription>
              Enter your account password to confirm it is you.
              Privacy Shield will remain on if the password is not confirmed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Password</label>
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submitPassword(); } }}
              placeholder="Account password"
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-[14px]"
            />
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} onClick={onCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !password}
              onClick={(e) => { e.preventDefault(); void submitPassword(); }}
            >
              {busy ? 'Checking…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ── Mode: set up PIN ──────────────────────────────────────────────────
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Set up App Lock PIN
          </AlertDialogTitle>
          <AlertDialogDescription>
            Choose a 4–6 digit PIN. It is stored only on this device.
            Privacy Shield will turn off once your PIN is set.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={newPin}
            disabled={busy}
            onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '')); setError(null); }}
            placeholder="New PIN"
            className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-[14px]"
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={confirmPin}
            disabled={busy}
            onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submitSetupPin(); } }}
            placeholder="Confirm PIN"
            className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-[14px]"
          />
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || !newPin || !confirmPin}
            onClick={(e) => { e.preventDefault(); void submitSetupPin(); }}
          >
            {busy ? 'Saving…' : 'Save PIN'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PrivacyShieldDisableGate;
