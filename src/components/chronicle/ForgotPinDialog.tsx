import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useLock } from '@/contexts/LockContext';
import { supabase } from '@/integrations/supabase/client';
import { isValidPinFormat } from '@/lib/lock/pinCrypto';

/**
 * Recover from a forgotten PIN by re-authenticating with the account
 * password. On success the user sets a new PIN and the app unlocks.
 *
 * No data is destroyed; this is purely a key-replacement step.
 */
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ForgotPinDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { setPin, markRecoveryUnlock } = useLock();
  const [step, setStep] = useState<'password' | 'newPin'>('password');
  const [password, setPassword] = useState('');
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep('password');
    setPassword('');
    setPinValue('');
    setPinConfirm('');
    setError(null);
    setBusy(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handlePasswordSubmit = async () => {
    if (!user?.email || !password) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    setBusy(false);
    if (signInError) {
      setError('Incorrect password.');
      return;
    }
    setStep('newPin');
  };

  const handlePinSubmit = async () => {
    if (!isValidPinFormat(pin)) {
      setError('PIN must be 4–6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPin(pin);
      markRecoveryUnlock();
      handleClose(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set PIN.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset PIN</DialogTitle>
          <DialogDescription>
            {step === 'password'
              ? 'Confirm your account password to reset your PIN. Your records are not affected.'
              : 'Choose a new 4–6 digit PIN.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'password' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="recovery-password">Account password</Label>
              <Input
                id="recovery-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-pin">New PIN</Label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={e => setPinValue(e.target.value.replace(/\D/g, ''))}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pin-confirm">Confirm PIN</Label>
              <Input
                id="new-pin-confirm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinConfirm}
                onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                disabled={busy}
              />
            </div>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={busy}>Cancel</Button>
          {step === 'password' ? (
            <Button onClick={handlePasswordSubmit} disabled={busy || !password}>
              {busy ? 'Checking…' : 'Continue'}
            </Button>
          ) : (
            <Button onClick={handlePinSubmit} disabled={busy || !pin || !pinConfirm}>
              {busy ? 'Saving…' : 'Set PIN'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPinDialog;
