/**
 * useExportGate — shared Privacy-Shield-aware gate for export actions.
 *
 * Any export action (open builder, generate, print, open document, download,
 * share, single-record share, etc.) MUST be wrapped via `requireGated`.
 *
 * When Privacy Shield is OFF:
 *   The action runs immediately. No dialogs. Backwards-compatible.
 *
 * When Privacy Shield is ON:
 *   1. App Lock re-authentication (biometric or PIN, or explicit
 *      "continue without App Lock" if not configured).
 *   2. Export disclosure confirmation.
 *   3. Then — and only then — the action runs.
 *
 *   Cancelling either step aborts. Auth failure aborts. The action is
 *   never invoked unless both steps complete successfully.
 *
 * Temporary unlock:
 *   After successful auth, subsequent gated actions in the same session
 *   skip auth (still require disclosure). This grant is in-memory only and
 *   is invalidated on:
 *     - Privacy Shield toggle (any direction)
 *     - App Lock engaging (isLocked → true)
 *     - User sign-out / change
 *     - Tab/app backgrounding (visibilitychange → hidden)
 *
 * Render <ExportGateDialogs/> from the hook return inside the consuming
 * component so the dialogs mount in-tree.
 */
import { useCallback, useEffect, useState } from 'react';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useLock } from '@/contexts/LockContext';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDialog from '@/components/chronicle/ConfirmDialog';
import ExportAuthGate from '@/components/chronicle/ExportAuthGate';

export function useExportGate() {
  const { enabled: privacyEnabled } = usePrivacy();
  const { isLocked: appIsLocked } = useLock();
  const { user } = useAuth();

  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [exportUnlocked, setExportUnlocked] = useState(false);

  // Invalidate temporary unlock on every trust-boundary change.
  useEffect(() => { setExportUnlocked(false); }, [privacyEnabled]);
  useEffect(() => { if (appIsLocked) setExportUnlocked(false); }, [appIsLocked]);
  useEffect(() => { setExportUnlocked(false); }, [user?.id]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setExportUnlocked(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // If Privacy Shield is toggled off mid-flow, abort any pending dialog.
  useEffect(() => {
    if (!privacyEnabled) {
      setAuthGateOpen(false);
      setDisclosureOpen(false);
      setPendingAction(null);
    }
  }, [privacyEnabled]);

  const cancelPending = useCallback(() => {
    setPendingAction(null);
    setAuthGateOpen(false);
    setDisclosureOpen(false);
  }, []);

  const requireGated = useCallback((action: () => void) => {
    if (!privacyEnabled) {
      action();
      return;
    }
    setPendingAction(() => action);
    if (exportUnlocked) {
      setDisclosureOpen(true);
    } else {
      setAuthGateOpen(true);
    }
  }, [privacyEnabled, exportUnlocked]);

  const onAuthSuccess = useCallback(() => {
    setAuthGateOpen(false);
    setExportUnlocked(true);
    setDisclosureOpen(true);
  }, []);

  const onDisclosureConfirm = useCallback(() => {
    const action = pendingAction;
    setDisclosureOpen(false);
    setPendingAction(null);
    if (action) action();
  }, [pendingAction]);

  const dialogs = (
    <>
      <ExportAuthGate
        open={authGateOpen}
        onAuthenticated={onAuthSuccess}
        onCancel={cancelPending}
      />
      <ConfirmDialog
        open={disclosureOpen}
        title="Before you export"
        description={
          <>
            Exported files leave Chronicle's protected app environment.
            <br /><br />
            This file may contain names, locations, quotes, attachments, and
            other sensitive details from your records. Once exported, it can
            be copied, forwarded, printed, or viewed by anyone who has access
            to the file.
            <br /><br />
            Privacy Shield only masks information inside the app. It does not
            protect exported files.
            <br /><br />
            Only export or share this document if you are comfortable with that.
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="I understand — continue"
        onCancel={cancelPending}
        onConfirm={onDisclosureConfirm}
      />
    </>
  );

  return { requireGated, dialogs, privacyEnabled };
}
