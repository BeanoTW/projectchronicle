import { useEffect, useState } from 'react';
import { checkPasswordBreached, evaluatePassword, type BreachStatus } from '@/lib/passwordPolicy';

/**
 * Debounced compromised-password check. Only runs once the composition rules
 * pass, so we never send hash prefixes for half-typed passwords.
 */
export function usePasswordBreachCheck(password: string, delayMs = 450): BreachStatus {
  const [status, setStatus] = useState<BreachStatus>('idle');

  useEffect(() => {
    if (!password || !evaluatePassword(password).valid) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkPasswordBreached(password, controller.signal)
        .then(result => { if (!controller.signal.aborted) setStatus(result); })
        .catch(() => setStatus('unavailable'));
    }, delayMs);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [password, delayMs]);

  return status;
}
