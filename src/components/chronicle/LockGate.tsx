import { useEffect, useState } from 'react';
import { Lock, Fingerprint, Delete } from 'lucide-react';
import { useLock } from '@/contexts/LockContext';
import { Button } from '@/components/ui/button';
import ForgotPinDialog from './ForgotPinDialog';

/**
 * Full-screen unlock surface. Rendered by ProtectedRoute when the lock is
 * configured and currently engaged. Uses existing design tokens — no new
 * route, no new screen entry.
 */
const LockGate = () => {
  const {
    biometricSupported, biometricEnabled, attemptsRemaining, lockoutUntil,
    unlockWithPin, unlockWithBiometric,
  } = useLock();

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick once a second while a cooldown is active.
  useEffect(() => {
    if (!lockoutUntil || lockoutUntil <= Date.now()) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [lockoutUntil]);

  const cooldownRemainingMs = lockoutUntil ? Math.max(0, lockoutUntil - now) : 0;
  const inCooldown = cooldownRemainingMs > 0;

  // Auto-prompt biometric once on mount when available.
  useEffect(() => {
    if (biometricEnabled && biometricSupported && !inCooldown) {
      void handleBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPin = async (value: string) => {
    if (busy || inCooldown) return;
    setBusy(true);
    setError(null);
    const res = await unlockWithPin(value);
    setBusy(false);
    if (res.ok) {
      setPin('');
      return;
    }
    if (res.reason === 'locked_out') {
      setError('Too many attempts. Try again shortly.');
    } else if (res.reason === 'no_pin') {
      setError('No PIN configured.');
    } else {
      setError('Incorrect PIN.');
    }
    setPin('');
  };

  const handleBiometric = async () => {
    if (biometricBusy || inCooldown) return;
    setBiometricBusy(true);
    setError(null);
    const res = await unlockWithBiometric();
    setBiometricBusy(false);
    if (!res.ok && res.reason !== 'cancelled' && res.reason !== 'no_credential') {
      setError('Biometric unavailable.');
    }
  };

  const onDigit = (d: string) => {
    if (inCooldown || busy) return;
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) {
      // Auto-submit when length reaches 6, otherwise wait for explicit submit.
      if (next.length === 6) void submitPin(next);
    }
  };

  const onBackspace = () => {
    if (inCooldown || busy) return;
    setPin(p => p.slice(0, -1));
  };

  const onSubmit = () => {
    if (pin.length >= 4) void submitPin(pin);
  };

  const formatCountdown = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
  };

  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center max-w-sm w-full">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-5">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-[18px] font-semibold text-foreground">Chronicle is locked</h1>
        <p className="text-[13px] text-muted-foreground mt-1 text-center leading-relaxed">
          {inCooldown
            ? `Too many attempts. Try again in ${formatCountdown(cooldownRemainingMs)}.`
            : 'Enter your PIN to continue.'}
        </p>

        {/* Dots */}
        <div className="flex gap-3 mt-7 mb-2">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${
                filled ? 'bg-foreground' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-[12px] text-destructive mt-2 h-4">{error}</p>
        )}
        {!error && !inCooldown && attemptsRemaining < 5 && attemptsRemaining > 0 && (
          <p className="text-[12px] text-muted-foreground mt-2 h-4">
            {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} left
          </p>
        )}
        {!error && (inCooldown || (attemptsRemaining === 5)) && (
          <p className="h-4 mt-2" />
        )}

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-3 mt-5 w-full max-w-[260px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onDigit(d)}
              disabled={inCooldown || busy}
              className="h-14 rounded-lg bg-muted hover:bg-muted/70 active:scale-[0.97] transition text-[20px] font-medium text-foreground disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={biometricEnabled && biometricSupported ? handleBiometric : undefined}
            disabled={!biometricEnabled || !biometricSupported || biometricBusy || inCooldown}
            className="h-14 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition"
            aria-label="Use biometric"
          >
            {biometricEnabled && biometricSupported ? <Fingerprint className="h-5 w-5" /> : null}
          </button>
          <button
            type="button"
            onClick={() => onDigit('0')}
            disabled={inCooldown || busy}
            className="h-14 rounded-lg bg-muted hover:bg-muted/70 active:scale-[0.97] transition text-[20px] font-medium text-foreground disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            onClick={onBackspace}
            disabled={inCooldown || busy || pin.length === 0}
            className="h-14 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition"
            aria-label="Backspace"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {pin.length >= 4 && pin.length < 6 && (
          <Button
            variant="default"
            className="mt-4 w-full max-w-[260px]"
            onClick={onSubmit}
            disabled={busy || inCooldown}
          >
            Unlock
          </Button>
        )}

        <button
          type="button"
          onClick={() => setForgotOpen(true)}
          className="mt-6 text-[13px] text-muted-foreground hover:text-foreground transition"
        >
          Forgot PIN?
        </button>
      </div>

      <ForgotPinDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
};

export default LockGate;
