/**
 * AttachmentUnlockDialog — small PIN prompt rendered globally so any
 * attachment surface can request reveal via useAttachmentReveal().
 *
 * Reuses the existing Chronicle app-lock PIN (LockContext.unlockWithPin).
 * Does NOT disable Privacy Shield on success — only grants session reveal.
 */
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLock } from '@/contexts/LockContext';
import { useAttachmentReveal } from '@/contexts/AttachmentRevealContext';

const AttachmentUnlockDialog = () => {
  const { _promptOpen, _resolvePrompt } = useAttachmentReveal();
  const { unlockWithPin, isLockConfigured } = useLock();

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (_promptOpen) {
      setPin('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [_promptOpen]);

  const onCancel = () => _resolvePrompt(false);

  const onSubmit = async () => {
    if (!pin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await unlockWithPin(pin);
      if (res.ok) {
        _resolvePrompt(true);
      } else {
        setError('Incorrect PIN.');
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  // If the user has no PIN configured at all, allow viewing — the gate is
  // pointless without one and we shouldn't trap them.
  useEffect(() => {
    if (_promptOpen && !isLockConfigured) _resolvePrompt(true);
  }, [_promptOpen, isLockConfigured, _resolvePrompt]);

  return (
    <AlertDialog open={_promptOpen} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Unlock attachment
          </AlertDialogTitle>
          <AlertDialogDescription>
            Enter your Chronicle PIN to view saved attachments while Privacy Shield is enabled.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            disabled={busy}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onSubmit(); } }}
            placeholder="PIN"
            className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-[14px] tracking-[0.4em] text-center"
          />
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || !pin}
            onClick={(e) => { e.preventDefault(); void onSubmit(); }}
          >
            {busy ? 'Checking…' : 'Unlock'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AttachmentUnlockDialog;
