/**
 * ExportAuthGate — re-authentication dialog required before export actions
 * when Privacy Shield is enabled.
 *
 * Flow:
 *   1. If App Lock is configured → require biometric (when available) or PIN.
 *   2. If App Lock is NOT configured → show a warning explaining that the
 *      export cannot be protected by app authentication, and require an
 *      explicit "I understand, continue" confirmation.
 *
 * On success, calls onAuthenticated(). On cancel/failure, calls onCancel().
 *
 * This dialog does NOT touch stored data and does NOT alter the export.
 * The temporary unlocked state is held by the parent (ExportScreen) and
 * must expire when the app locks, backgrounds, Privacy Shield toggles, or
 * the user signs out.
 */
import { useEffect, useRef, useState } from 'react';
import { Lock, Fingerprint, ShieldAlert } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useLock } from '@/contexts/LockContext';

interface Props {
  open: boolean;
  onAuthenticated: () => void;
  onCancel: () => void;
}

const ExportAuthGate = ({ open, onAuthenticated, onCancel }: Props) => {
  const {
    isLockConfigured, biometricEnabled, biometricSupported,
    unlockWithPin, unlockWithBiometric,
  } = useLock();

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const biometricAttemptedRef = useRef(false);

  // Reset state on open. Auto-prompt biometric once if available.
  useEffect(() => {
    if (!open) {
      biometricAttemptedRef.current = false;
      return;
    }
    setPin('');
    setError(null);
    setBusy(false);
    setBioBusy(false);

    if (
      isLockConfigured && biometricEnabled && biometricSupported &&
      !biometricAttemptedRef.current
    ) {
      biometricAttemptedRef.current = true;
      void tryBiometric();
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tryBiometric = async () => {
    setBioBusy(true);
    setError(null);
    try {
      const res = await unlockWithBiometric();
      if (res.ok) {
        onAuthenticated();
        return;
      }
      // Cancellation is silent; fall through to PIN entry.
      if (res.reason && res.reason !== 'cancelled' && res.reason !== 'no_credential') {
        setError('Biometric unlock unavailable. Enter your PIN to continue.');
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
      const res = await unlockWithPin(pin);
      if (res.ok) {
        onAuthenticated();
      } else if (res.reason === 'locked_out') {
        setError('Too many attempts. Try again shortly.');
        setPin('');
      } else {
        setError('Incorrect PIN.');
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────
  // No App Lock configured → warn + require explicit confirmation.
  // ──────────────────────────────────────────────────────────────────
  if (open && !isLockConfigured) {
    return (
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-foreground/80" /> App Lock not set up
            </AlertDialogTitle>
            <AlertDialogDescription>
              Privacy Shield is on, but App Lock (PIN or biometric) is not set
              up on this device. Without App Lock, this export cannot be
              protected by Chronicle authentication before it leaves the app.
              <br /><br />
              You can set up App Lock in Settings, or continue without it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); onAuthenticated(); }}
            >
              Continue without App Lock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // App Lock configured → require biometric (if available) or PIN.
  // ──────────────────────────────────────────────────────────────────
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Authenticate to export
          </AlertDialogTitle>
          <AlertDialogDescription>
            Privacy Shield is on. Confirm it's you before preparing or sharing
            an export.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {biometricEnabled && biometricSupported && (
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
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              PIN
            </label>
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
          <AlertDialogCancel disabled={busy || bioBusy} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || bioBusy || !pin}
            onClick={(e) => { e.preventDefault(); void submitPin(); }}
          >
            {busy ? 'Checking…' : 'Unlock'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ExportAuthGate;
