import { useState } from 'react';
import { LogOut, ShieldCheck, Download, HelpCircle, ChevronRight, Eye, EyeOff, Fingerprint, Cloud, Loader2, CloudUpload, CloudDownload, Database } from 'lucide-react';
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
    localCount, cloudCount, lastBackupAt, lastRestoreAt, syncStatus,
    setBackupEnabled, retrySyncNow, backupNow, restoreFromCloud, deleteCloudData, refreshCloudCount,
  } = useBackup();
  const { enabled: privacyEnabled, setEnabled: setPrivacyEnabled } = usePrivacy();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[14px] text-foreground">Enable cloud backup</span>
              </div>
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
