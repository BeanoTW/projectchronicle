import { useState } from 'react';
import { LogOut, ShieldCheck, Download, HelpCircle, ChevronRight, Eye, EyeOff, Fingerprint, Cloud, Loader2, CloudUpload, CloudDownload, Database, Trash2 } from 'lucide-react';
import PageHeader from '@/components/chronicle/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIncidents } from '@/hooks/useIncidents';
import { useBackup } from '@/contexts/BackupContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { format } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const SettingsScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: incidents } = useIncidents();
  const {
    backupEnabled, online, pendingCount, lastSyncAttemptAt, lastSyncResult,
    localCount, cloudCount, cloudLastUpdatedAt, lastBackupAt, lastRestoreAt, syncStatus,
    setBackupEnabled, retrySyncNow, backupNow, restoreFromCloud, deleteCloudData, refreshCloudCount,
  } = useBackup();
  const { enabled: privacyEnabled, setEnabled: setPrivacyEnabled } = usePrivacy();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const { error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      toast({ title: 'Your account has been deleted.' });
      setDeleteAccountOpen(false);
      navigate('/welcome');
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Logged out' });
    navigate('/login');
  };

  const totalIncidents = incidents?.length ?? 0;
  const firstRecord = incidents?.length
    ? incidents.reduce((earliest, i) => (i.created_at < earliest ? i.created_at : earliest), incidents[0].created_at)
    : null;
  const lastUpdated = incidents?.length
    ? incidents.reduce((latest, i) => (i.updated_at > latest ? i.updated_at : latest), incidents[0].updated_at)
    : null;

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Settings" hideSettings />

      {/* Hero — Your Record */}
      <div className="mx-5 mb-6 bg-card border border-border rounded-xl p-5">
        <h2 className="text-[18px] font-bold text-foreground mb-1">Your record</h2>
        <p className="text-[13px] text-muted-foreground mb-4">Your records are private and under your control.</p>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] text-muted-foreground">Total incidents</span>
            <span className="text-[20px] font-bold text-foreground tabular-nums">{totalIncidents}</span>
          </div>
          {firstRecord && (
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] text-muted-foreground">First record</span>
              <span className="text-[14px] font-medium text-foreground">{format(new Date(firstRecord), 'd MMM yyyy')}</span>
            </div>
          )}
          {lastUpdated && (
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] text-muted-foreground">Last updated</span>
              <span className="text-[14px] font-medium text-foreground">{format(new Date(lastUpdated), 'd MMM yyyy')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Control */}
      <div className="mx-5 mb-6">
        <p className="section-group-title">Control</p>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Privacy */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-[14px] font-semibold text-foreground">Privacy & control</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 flex-1">
                {privacyEnabled ? (
                  <EyeOff className="h-4 w-4 text-primary mt-0.5" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-[14px] text-foreground">Privacy Shield</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                    Visually mask names, locations, quotes, narratives, and attachment file names across the app. Stored data and exports are unaffected.
                  </p>
                </div>
              </div>
              <Switch
                checked={privacyEnabled}
                onCheckedChange={setPrivacyEnabled}
                aria-label="Toggle Privacy Shield"
              />
            </div>
            <div className="flex items-center justify-between opacity-40">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <span className="text-[14px] text-foreground">Require PIN or biometric</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Soon</span>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Cloud backup */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="h-4 w-4 text-primary" />
              <span className="text-[14px] font-semibold text-foreground">Cloud backup</span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Your records are stored on this device. Cloud backup is optional and uploads them to your account so they can be restored on another device.
            </p>

            {/* Data state — what you're viewing */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-[12px]">
              <div className="flex items-center gap-1.5 text-foreground font-medium mb-1">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>Data state</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Records on this device</span>
                <span className="text-foreground tabular-nums font-medium">{localCount}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Records in cloud backup</span>
                <span className="text-foreground tabular-nums font-medium">
                  {cloudCount === null ? (online ? '—' : 'offline') : (cloudCount === 0 ? 'None' : cloudCount)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Sync status</span>
                <span className="text-foreground font-medium">
                  {syncStatus === 'in_sync' && 'In sync'}
                  {syncStatus === 'local_newer' && 'Local is newer'}
                  {syncStatus === 'cloud_newer' && 'Cloud is newer'}
                  {syncStatus === 'cloud_unavailable' && 'Cloud unavailable'}
                  {syncStatus === 'local_only' && 'Local only (no cloud data)'}
                  {syncStatus === 'unknown' && (online ? 'Checking…' : 'Offline')}
                </span>
              </div>
              {cloudLastUpdatedAt && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Last cloud update</span>
                  <span className="text-foreground">{format(new Date(cloudLastUpdatedAt), 'd MMM HH:mm')}</span>
                </div>
              )}
              {lastBackupAt && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Last backup from this device</span>
                  <span className="text-foreground">{format(new Date(lastBackupAt), 'd MMM HH:mm')}</span>
                </div>
              )}
              {lastRestoreAt && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Last restore</span>
                  <span className="text-foreground">{format(new Date(lastRestoreAt), 'd MMM HH:mm')}</span>
                </div>
              )}
              <button
                onClick={() => refreshCloudCount()}
                className="text-[11px] text-primary hover:underline pt-0.5"
                disabled={!online}
              >
                Refresh cloud status
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] text-foreground">Enable cloud backup</span>
              <Switch
                checked={backupEnabled}
                disabled={busy}
                onCheckedChange={async (v) => {
                  setBusy(true);
                  try { await setBackupEnabled(v); } finally { setBusy(false); }
                }}
              />
            </div>

            <div className="text-[12px] text-muted-foreground space-y-1 pt-1">
              <div className="flex justify-between"><span>Status</span><span className="text-foreground">{backupEnabled ? (online ? 'On — uploading when online' : 'On — offline, will retry') : 'Off — local only'}</span></div>
              <div className="flex justify-between"><span>Pending upload</span><span className="text-foreground tabular-nums">{pendingCount}</span></div>
              {lastSyncAttemptAt && (
                <div className="flex justify-between"><span>Last attempt</span><span className="text-foreground">{format(new Date(lastSyncAttemptAt), 'd MMM HH:mm')}</span></div>
              )}
              {lastSyncResult?.lastError && (
                <div className="flex justify-between"><span>Last error</span><span className="text-foreground truncate max-w-[180px]">{lastSyncResult.lastError}</span></div>
              )}
            </div>

            {/* Explicit user-controlled actions. Restore is enabled whenever cloud
                data exists, even if the backup toggle is OFF. */}
            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                onClick={async () => { setBusy(true); try { await backupNow(); } finally { setBusy(false); } }}
                disabled={busy || !online || !backupEnabled}
                className="flex items-center justify-center gap-1.5 text-[13px] text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                Save this device's records to your cloud backup
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={!online || cloudCount === null || cloudCount === 0}
                    className="flex items-center justify-center gap-1.5 text-[13px] text-foreground border border-border hover:bg-muted/50 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CloudDownload className="h-3.5 w-3.5" />
                    Replace this device's records with your cloud backup
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Replace this device's records with your cloud backup?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace all records on this device ({localCount}) with your cloud backup ({cloudCount ?? '—'} records). Any records on this device that have not been backed up will be lost. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={restoring}
                      onClick={async () => {
                        setRestoring(true);
                        try {
                          const res = await restoreFromCloud();
                          toast({ title: 'Restore complete', description: `${res.incidents} record(s) and ${res.notes} note(s) restored from cloud.` });
                        } catch (e) {
                          toast({ title: 'Restore failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
                        } finally {
                          setRestoring(false);
                        }
                      }}
                    >
                      Replace local records
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {backupEnabled && pendingCount > 0 && (
              <button
                onClick={async () => { setBusy(true); try { await retrySyncNow(); } finally { setBusy(false); } }}
                disabled={busy || !online}
                className="w-full text-[13px] text-primary py-2 hover:bg-muted/30 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                Retry backup now
              </button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full text-[13px] text-destructive py-2 hover:bg-destructive/5 rounded-lg transition-colors">
                  Delete cloud copy
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete cloud copy of your records?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes records previously uploaded to your cloud account. Records on this device are not affected and will remain available locally. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        const res = await deleteCloudData();
                        toast({ title: 'Cloud copy deleted', description: `${res.incidents} records and ${res.notes} notes removed from your cloud account. Local copies are unchanged.` });
                      } catch (e) {
                        toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
                      } finally {
                        setDeleting(false);
                      }
                    }}
                  >
                    Delete cloud copy
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>


          <div className="border-t border-border" />

          {/* Export */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-4 w-4 text-primary" />
              <span className="text-[14px] font-semibold text-foreground">Export & backup</span>
            </div>
            <p className="text-[12px] text-muted-foreground mb-2">Your data belongs to you.</p>
            {['Export full record', 'Export timeline', 'Export individual incidents'].map((label) => (
              <button
                key={label}
                onClick={() => navigate('/export')}
                className="w-full flex items-center justify-between py-2.5 text-[14px] text-foreground hover:bg-muted/30 rounded-lg px-1 transition-colors"
              >
                {label}
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="mx-5 mb-6">
        <p className="section-group-title">Support</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => navigate('/rights')}
            className="w-full flex items-center justify-between p-4 text-[14px] text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>Rights & guidance</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="mx-5 mb-6">
        <p className="section-group-title">Account</p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4">
            <p className="text-[12px] text-muted-foreground mb-0.5">Logged in as</p>
            <p className="text-[14px] text-foreground font-medium">{user?.email}</p>
          </div>
          <div className="border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 p-4 text-[14px] text-destructive hover:bg-destructive/4 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
          <div className="border-t border-border">
            <AlertDialog
              open={deleteAccountOpen}
              onOpenChange={(o) => {
                setDeleteAccountOpen(o);
                if (!o) setDeleteConfirm('');
              }}
            >
              <AlertDialogTrigger asChild>
                <button
                  className="w-full flex items-center gap-2 p-4 text-[14px] text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete account
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete account?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-[13px] text-muted-foreground">
                      <p>This will permanently delete your account and associated cloud data. This action cannot be undone.</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Your account access will be removed.</li>
                        <li>All records, notes, and attachments stored in your cloud backup will be deleted.</li>
                        <li>Records stored only on this device will remain on this device but cannot be restored once your account is gone, unless you have separately exported them.</li>
                      </ul>
                      <p className="pt-2 text-foreground">Type <span className="font-mono font-semibold">DELETE</span> to confirm.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <input
                  type="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full border border-border rounded-lg px-3 py-2 text-[14px] font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-destructive/30"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleteConfirm.trim() !== 'DELETE' || deletingAccount}
                    onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingAccount && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Delete account permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="mx-5 mb-8">
        <p className="section-group-title">About</p>
        <div className="px-1 space-y-1">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            This tool helps you capture and organise events clearly, as they happen. It does not provide legal advice.
          </p>
          <p className="text-[12px] text-muted-foreground/60">Project Chronicle · v0.1.0</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
