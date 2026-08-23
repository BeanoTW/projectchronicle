// Phase 9 — production V2 Settings surface.
//
// Reuses the existing production systems only: AuthContext (session + sign
// out), ThemeContext (appearance), PrivacyContext (Privacy Shield),
// BackupContext (sync/backup + local/cloud data), useIncidents (counts) and
// the existing `delete-account` function. No second auth or theme system.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useBackup } from '@/contexts/BackupContext';
import { useLock } from '@/contexts/LockContext';
import { useIncidents } from '@/hooks/useIncidents';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppSurface from '@/chronicle/shared/AppSurface';
import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';
import {
  SettingsChoice,
  SettingsDeferred,
  SettingsLinkRow,
  SettingsRow,
  SettingsSection,
  SettingsToggle,
} from '@/chronicle/shared/SettingsView';
import PrivacyShieldDisableGate from '@/components/chronicle/PrivacyShieldDisableGate';
import { clearUserScopedState } from '@/chronicle/shared/sessionCleanup';
import { APP_VERSION } from '@/lib/appVersion';
import { APP_LOCK_TIMEOUT_OPTIONS, validateLockPinSetup } from '@/lib/lock/lockSettings';
import '@/chronicle/styles.css';

export const PRIVACY_SHIELD_COPY =
  'Privacy Shield hides sensitive record content on screen. It does not alter or delete your stored records.';

const SettingsScreen = () => {
  // Settings is part of the V2 shell, so V2 owns navigation here too.
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, unsyncedCount } = useAuth();
  const { mode, setMode } = useTheme();
  const {
    isLockConfigured, biometricSupported, biometricEnabled, lockTimeoutMs,
    setPin, removeLock, enableBiometric, disableBiometric, setTimeout: setLockTimeout, lockNow,
  } = useLock();
  const { enabled: shielded, setEnabled: setShielded } = usePrivacy();
  const { data: incidents } = useIncidents();
  const {
    backupEnabled, online, localCount, cloudCount, conflictCount, lastBackupAt, syncStatus,
    setBackupEnabled,
  } = useBackup();

  const [shieldGateOpen, setShieldGateOpen] = useState(false);
  const [changingBackup, setChangingBackup] = useState(false);
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [removeLockOpen, setRemoveLockOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const [changingBiometric, setChangingBiometric] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const recordCount = incidents?.length ?? 0;

  const syncLabel = useMemo(() => {
    if (!backupEnabled) return 'Off — records stay on this device';
    if (conflictCount > 0) return `${conflictCount} record${conflictCount === 1 ? '' : 's'} need review`;
    if (!online) return 'Offline — will back up when reconnected';
    if (syncStatus === 'in_sync') return 'Backed up';
    if (lastBackupAt) return 'Backed up earlier';
    return 'Waiting to back up';
  }, [backupEnabled, conflictCount, online, syncStatus, lastBackupAt]);

  const openPinSheet = () => {
    setNewPin('');
    setConfirmPin('');
    setPinError(null);
    setPinSheetOpen(true);
  };

  const handleSavePin = async () => {
    const validationError = validateLockPinSetup(newPin, confirmPin);
    if (validationError) {
      setPinError(validationError);
      return;
    }
    setSavingPin(true);
    setPinError(null);
    try {
      await setPin(newPin);
      setPinSheetOpen(false);
      setNewPin('');
      setConfirmPin('');
      toast({
        title: isLockConfigured ? 'App lock PIN changed' : 'App lock turned on',
        description: 'This PIN protects Chronicle on this device only.',
      });
    } catch {
      setPinError('The PIN could not be saved. Please try again.');
    } finally {
      setSavingPin(false);
    }
  };

  const handleBiometricChange = async (enabled: boolean) => {
    setChangingBiometric(true);
    try {
      if (enabled) await enableBiometric();
      else disableBiometric();
      toast({ title: enabled ? 'Biometric unlock turned on' : 'Biometric unlock turned off' });
    } catch {
      toast({
        title: 'Biometric unlock could not be changed',
        description: 'Your PIN still works and no lock settings were removed.',
        variant: 'destructive',
      });
    } finally {
      setChangingBiometric(false);
    }
  };

  const handleRemoveLock = () => {
    removeLock();
    setRemoveLockOpen(false);
    toast({
      title: 'App lock removed',
      description: 'Your Chronicle account and records are unchanged.',
    });
  };

  const handleBackupChange = async (enabled: boolean) => {
    setChangingBackup(true);
    try {
      await setBackupEnabled(enabled);
    } catch {
      toast({
        title: enabled ? 'Could not turn on cloud backup' : 'Could not turn off cloud backup',
        description: 'Your records have not been changed. Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setChangingBackup(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      // Clear user-specific transient UI state and drafts BEFORE the session
      // ends, so nothing can be shown to the next account on this device.
      clearUserScopedState();
      // Warn plainly if anything is only on this device: sign-out moves those
      // records out of the live store (they are restored when you sign back
      // in on this device) so a second account cannot read them.
      const pending = await unsyncedCount();
      await signOut();
      toast({
        title: 'Signed out',
        description: pending > 0
          ? `${pending} ${pending === 1 ? 'record is' : 'records are'} saved only on this device. They are kept safely and will reappear when you sign in again here.`
          : undefined,
      });
      navigate('/login', { replace: true });
    } catch (e) {
      setSignOutError(
        e instanceof Error && e.message
          ? `Sign out failed: ${e.message}. You are still signed in on this device.`
          : 'Sign out failed. You are still signed in on this device. Please try again.',
      );
    } finally {
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const { error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      clearUserScopedState();
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      toast({ title: 'Your account has been deleted.' });
      setDeleteOpen(false);
      navigate('/', { replace: true });
    } catch (e) {
      toast({
        title: 'Unable to delete account right now. Please try again.',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <AppSurface>
      <div className="proto-page" data-testid="v2-settings">
        <ChroniclePageHeader
          title="Settings"
          eyebrow="Record controls"
          subtitle="Your account, appearance, privacy and data."
        />

        <div className="proto-settings-grid">
        {/* ACCOUNT */}
        <SettingsSection title="Account">
          <SettingsRow
            label="Signed in as"
            value={user?.email ?? 'Not signed in'}
          />
          <SettingsRow
            label="Account status"
            value={user ? 'Active' : 'Signed out'}
            help={user ? 'Your records are linked to this account.' : undefined}
          />
          <div className="proto-set-row">
            <button
              type="button"
              className="proto-btn proto-set-fullbtn"
              onClick={handleSignOut}
              disabled={signingOut}
              data-testid="v2-signout"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          {signOutError && (
            <p className="proto-set-error" role="alert" data-testid="v2-signout-error">
              {signOutError}
            </p>
          )}
        </SettingsSection>

        {/* APPEARANCE */}
        <SettingsSection title="Appearance">
          <SettingsChoice<ThemeMode>
            legend="Theme"
            help="System follows your device setting. Light and Dark override it on this device."
            value={mode}
            options={[
              { value: 'system', label: 'System default' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={setMode}
          />
        </SettingsSection>

        {/* PRIVACY */}
        <SettingsSection title="Privacy">
          <SettingsToggle
            label="Privacy Shield"
            help={PRIVACY_SHIELD_COPY}
            checked={shielded}
            testId="v2-privacy-shield"
            onChange={v => (v ? setShielded(true) : setShieldGateOpen(true))}
          />
          <SettingsToggle
            label="Cloud backup"
            help="Keep an account-linked cloud copy so your records can be restored if this device is lost or reset."
            checked={backupEnabled}
            disabled={!user || changingBackup}
            testId="v2-cloud-backup"
            onChange={v => { void handleBackupChange(v); }}
          />
          <SettingsRow
            label="Where your records live"
            help="Chronicle stores your records on this device first. Cloud backup is optional and linked to your account."
            value={`${localCount} on this device`}
          />
          <SettingsRow
            label="Backup and sync"
            value={syncLabel}
            help={
              cloudCount === null
                ? undefined
                : `${cloudCount} record${cloudCount === 1 ? '' : 's'} in cloud backup.`
            }
          />
          <SettingsLinkRow
            label="Open Backup & recovery"
            help="Check protection status, back up now, restore this device or review conflicting versions."
            onClick={() => navigate('/settings/backup')}
          />
        </SettingsSection>

        {/* SECURITY */}
        <SettingsSection
          title="App lock"
          description="Protect Chronicle on this device with a PIN and, where supported, your device biometric."
        >
          <SettingsRow
            label="PIN lock"
            value={isLockConfigured ? 'On' : 'Off'}
            help={isLockConfigured ? 'Required after Chronicle has been inactive.' : 'Your account password does not automatically lock an open app.'}
            action={
              <button type="button" className="proto-btn" onClick={openPinSheet}>
                {isLockConfigured ? 'Change PIN' : 'Set up'}
              </button>
            }
          />
          <SettingsToggle
            label="Biometric unlock"
            help={
              !biometricSupported
                ? 'Biometric unlock is not available in this browser or on this device.'
                : 'Use your phone, tablet or computer biometric instead of entering the PIN.'
            }
            checked={biometricEnabled}
            disabled={!isLockConfigured || !biometricSupported || changingBiometric}
            testId="v2-biometric-unlock"
            onChange={v => { void handleBiometricChange(v); }}
          />
          {isLockConfigured && (
            <SettingsChoice<string>
              legend="Lock automatically"
              help="Chronicle locks after it has been in the background or inactive for this long."
              value={String(lockTimeoutMs)}
              options={APP_LOCK_TIMEOUT_OPTIONS.map(option => ({ ...option }))}
              onChange={value => setLockTimeout(Number(value))}
            />
          )}
          {isLockConfigured && (
            <>
              <SettingsRow
                label="Lock Chronicle now"
                help="Return to the PIN screen immediately."
                action={<button type="button" className="proto-btn" onClick={lockNow}>Lock now</button>}
              />
              <div className="proto-set-row">
                <button
                  type="button"
                  className="proto-btn proto-set-fullbtn proto-set-danger"
                  onClick={() => setRemoveLockOpen(true)}
                >
                  Remove app lock
                </button>
              </div>
            </>
          )}
        </SettingsSection>

        {/* RECORDING */}
        <SettingsSection title="Recording">
          <SettingsRow
            label="Default record type"
            value="Incident"
            help="You can switch to a daily record on the Capture screen each time you write."
          />
          <SettingsRow
            label="Microphone access"
            value={
              typeof navigator !== 'undefined' && navigator.mediaDevices ? 'Supported on this device' : 'Not available'
            }
            help="Chronicle asks for microphone permission the first time you record with your voice."
          />
          <SettingsRow
            label="Attachments"
            help="Photos, documents and voice records are stored in your private Chronicle storage and always belong to a record."
          />
        </SettingsSection>

        {/* DATA */}
        <SettingsSection title="Data">
          <SettingsLinkRow
            label="Build a report from your records"
            help="Choose what to include, then export as PDF or Word."
            onClick={() => navigate('/export')}
          />
          <SettingsRow
            label="Records on this device"
            value={String(recordCount)}
            help="Records are held locally first. Clearing this browser's data removes local copies that are not backed up."
          />
          <SettingsDeferred
            label="Download a copy of all account data"
            reason="Report export is available today. A full account-data download is not supported yet, so nothing is offered here rather than improvising."
          />
          <div className="proto-set-row">
            <button
              type="button"
              className="proto-btn proto-set-fullbtn proto-set-danger"
              onClick={() => { setDeleteConfirm(''); setDeleteOpen(true); }}
              data-testid="v2-delete-account"
            >
              Delete account and all data
            </button>
          </div>
        </SettingsSection>

        {/* SUPPORT */}
        <SettingsSection title="Support">
          <SettingsLinkRow
            label="Help & support"
            help="Guidance and organisations that may be able to help."
            onClick={() => navigate('/support')}
          />
          <SettingsLinkRow label="How Chronicle works" onClick={() => navigate('/how-it-works')} />
          <SettingsLinkRow label="Privacy policy" onClick={() => navigate('/privacy')} />
          <SettingsLinkRow label="About Chronicle" onClick={() => navigate('/about')} />
          <SettingsRow label="App version" value={APP_VERSION} />
        </SettingsSection>
        </div>

      </div>

      {pinSheetOpen && (
        <div className="proto-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="app-lock-pin-title">
          <div className="proto-sheet">
            <div className="proto-sheet-head">
              <strong id="app-lock-pin-title">{isLockConfigured ? 'Change app lock PIN' : 'Set up app lock'}</strong>
            </div>
            <div className="proto-sheet-body">
              <p className="proto-help">
                Choose 4 to 6 numbers. The PIN is stored only on this device and is separate from your Chronicle password.
              </p>
              <label className="proto-flabel" htmlFor="app-lock-pin">New PIN</label>
              <input
                id="app-lock-pin"
                className="proto-input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="[0-9]*"
                minLength={4}
                maxLength={6}
                value={newPin}
                onChange={event => { setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(null); }}
                autoFocus
              />
              <label className="proto-flabel" htmlFor="app-lock-pin-confirm">Confirm PIN</label>
              <input
                id="app-lock-pin-confirm"
                className="proto-input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="[0-9]*"
                minLength={4}
                maxLength={6}
                value={confirmPin}
                onChange={event => { setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(null); }}
                onKeyDown={event => { if (event.key === 'Enter') void handleSavePin(); }}
              />
              {pinError && <p className="proto-set-error" role="alert">{pinError}</p>}
            </div>
            <div className="proto-sheet-foot">
              <button
                type="button"
                className="proto-btn"
                onClick={() => setPinSheetOpen(false)}
                disabled={savingPin}
              >
                Cancel
              </button>
              <button
                type="button"
                className="proto-btn"
                data-variant="primary"
                onClick={() => { void handleSavePin(); }}
                disabled={savingPin}
              >
                {savingPin ? 'Saving…' : isLockConfigured ? 'Change PIN' : 'Turn on app lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeLockOpen && (
        <div className="proto-sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="remove-app-lock-title">
          <div className="proto-sheet">
            <div className="proto-sheet-head">
              <strong id="remove-app-lock-title">Remove app lock?</strong>
            </div>
            <div className="proto-sheet-body">
              <p className="proto-help">
                Chronicle will stop asking for a PIN or biometric on this device. Your account, records and cloud backup are not removed.
              </p>
            </div>
            <div className="proto-sheet-foot">
              <button type="button" className="proto-btn" onClick={() => setRemoveLockOpen(false)}>Keep app lock</button>
              <button type="button" className="proto-btn proto-set-danger" onClick={handleRemoveLock}>Remove app lock</button>
            </div>
          </div>
        </div>
      )}

      <PrivacyShieldDisableGate
        open={shieldGateOpen}
        onConfirmed={() => { setShielded(false); setShieldGateOpen(false); }}
        onCancel={() => setShieldGateOpen(false)}
      />

      {deleteOpen && (
        <div className="proto-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Delete account">
          <div className="proto-sheet">
            <div className="proto-sheet-head">
              <strong>Delete account and all data</strong>
            </div>
            <div className="proto-sheet-body">
              <p className="proto-help">
                This permanently deletes your Chronicle account, your cloud copy and all records linked to it.
                Records stored only on this device are also removed. This cannot be undone, and nothing is
                deleted until the server confirms it.
              </p>
              <label className="proto-flabel" htmlFor="v2-delete-confirm">Type DELETE to confirm</label>
              <input
                id="v2-delete-confirm"
                className="proto-input"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="proto-sheet-foot">
              <button className="proto-btn" onClick={() => setDeleteOpen(false)} disabled={deletingAccount}>
                Cancel
              </button>
              <button
                className="proto-btn proto-set-danger"
                disabled={deleteConfirm !== 'DELETE' || deletingAccount}
                onClick={handleDeleteAccount}
              >
                {deletingAccount ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppSurface>
  );
};

export default SettingsScreen;
