/**
 * AttachmentRevealContext — session-scoped gate for viewing attachments
 * while Privacy Shield is enabled.
 *
 * Behaviour:
 * - When Privacy Shield is OFF, attachments are always considered revealed.
 * - When Privacy Shield is ON, the user must re-auth with their Chronicle PIN
 *   before thumbnails / previews / downloads are shown.
 * - "Revealed" state lives only in memory for this session and is cleared if:
 *     - the app lock locks again,
 *     - Privacy Shield is toggled,
 *     - the user signs out (provider unmounts on auth changes).
 *
 * This is NOT a private vault — it is a UI viewing gate only. We do not mark
 * attachments as private, do not change storage, and do not affect exports.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePrivacy } from './PrivacyContext';
import { useLock } from './LockContext';

interface AttachmentRevealValue {
  /** Whether attachments are currently visible in the UI. */
  revealed: boolean;
  /** True only when Privacy Shield is on AND user has not unlocked this session. */
  gateActive: boolean;
  /** Open the unlock prompt. Resolves true on success, false on cancel/fail. */
  requestReveal: () => Promise<boolean>;
  /** Internal — used by the dialog component. */
  _promptOpen: boolean;
  _resolvePrompt: (ok: boolean) => void;
}

const AttachmentRevealContext = createContext<AttachmentRevealValue | null>(null);

export const AttachmentRevealProvider = ({ children }: { children: React.ReactNode }) => {
  const { enabled: privacyOn } = usePrivacy();
  const { isLocked } = useLock();

  const [revealed, setRevealed] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);

  // Drop reveal whenever Privacy Shield toggles OR the app lock engages.
  useEffect(() => { setRevealed(false); }, [privacyOn]);
  useEffect(() => { if (isLocked) setRevealed(false); }, [isLocked]);

  const gateActive = privacyOn && !revealed;

  const requestReveal = useCallback((): Promise<boolean> => {
    if (!privacyOn) return Promise.resolve(true);
    if (revealed) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
      setPromptOpen(true);
    });
  }, [privacyOn, revealed]);

  const _resolvePrompt = useCallback((ok: boolean) => {
    setPromptOpen(false);
    if (ok) setRevealed(true);
    if (resolver) {
      resolver(ok);
      setResolver(null);
    }
  }, [resolver]);

  const value = useMemo<AttachmentRevealValue>(() => ({
    revealed: !privacyOn || revealed,
    gateActive,
    requestReveal,
    _promptOpen: promptOpen,
    _resolvePrompt,
  }), [privacyOn, revealed, gateActive, requestReveal, promptOpen, _resolvePrompt]);

  return (
    <AttachmentRevealContext.Provider value={value}>
      {children}
    </AttachmentRevealContext.Provider>
  );
};

export function useAttachmentReveal(): AttachmentRevealValue {
  const ctx = useContext(AttachmentRevealContext);
  if (!ctx) {
    return {
      revealed: true,
      gateActive: false,
      requestReveal: async () => true,
      _promptOpen: false,
      _resolvePrompt: () => {},
    };
  }
  return ctx;
}
