import { useState } from 'react';
import { LogOut, ShieldCheck, Download, HelpCircle, ChevronRight, Eye, Fingerprint, Cloud, Loader2 } from 'lucide-react';
import PageHeader from '@/components/chronicle/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIncidents } from '@/hooks/useIncidents';
import { useBackup } from '@/contexts/BackupContext';
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
  const { backupEnabled, online, pendingCount, lastSyncAttemptAt, lastSyncResult, setBackupEnabled, retrySyncNow, deleteCloudData } = useBackup();
  const [busy, setBusy] = useState(false);
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
            <div className="flex items-center justify-between opacity-40">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <span className="text-[14px] text-foreground">Require PIN or biometric</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Soon</span>
            </div>
            <div className="flex items-center justify-between opacity-40">
              <div className="flex items-center gap-2.5">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-[14px] text-foreground">Hide sensitive previews</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Soon</span>
            </div>
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
