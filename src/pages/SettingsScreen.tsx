import { LogOut, Info, ShieldCheck, FileText, Download, HelpCircle, ChevronRight, Lock, Eye, Fingerprint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIncidents } from '@/hooks/useIncidents';
import { format } from 'date-fns';

const SettingsScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: incidents } = useIncidents();

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
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Settings</h1>
      </div>

      <div className="px-4 space-y-3">
        {/* Your Record Summary */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            Your record
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total incidents</span>
              <span className="text-sm font-medium text-foreground">{totalIncidents}</span>
            </div>
            {firstRecord && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">First record</span>
                <span className="text-sm font-medium text-foreground">{format(new Date(firstRecord), 'd MMM yyyy')}</span>
              </div>
            )}
            {lastUpdated && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Last updated</span>
                <span className="text-sm font-medium text-foreground">{format(new Date(lastUpdated), 'd MMM yyyy')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Privacy & Control */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            </div>
            Privacy & control
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Your records are private and under your control.</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Lock records after saving</span>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between opacity-50">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Require PIN or biometric access</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming soon</span>
            </div>
            <div className="flex items-center justify-between opacity-50">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Hide sensitive previews</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Export & Backup */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="h-3.5 w-3.5 text-primary" />
            </div>
            Export & backup
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Your data belongs to you. Export it at any time.</p>
          <div className="space-y-1">
            {['Export full record', 'Export timeline', 'Export individual incidents'].map((label) => (
              <button
                key={label}
                onClick={() => navigate('/export')}
                className="w-full flex items-center justify-between py-2.5 text-sm text-foreground hover:bg-muted/50 rounded-lg px-2 transition-colors"
              >
                {label}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {/* Guidance & Support */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
            </div>
            Guidance & support
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Get help understanding your situation.</p>
          <div className="space-y-1">
            <button
              onClick={() => navigate('/rights')}
              className="w-full flex items-center justify-between py-2.5 text-sm text-foreground hover:bg-muted/50 rounded-lg px-2 transition-colors"
            >
              Rights & guidance
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3">Account</h2>
          <p className="text-[11px] text-muted-foreground mb-1">Logged in as</p>
          <p className="text-sm text-foreground font-medium mb-4">{user?.email}</p>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground h-10 rounded-xl hover:text-destructive hover:bg-destructive/5"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" /> Log out
          </Button>
        </div>

        {/* About */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="h-3.5 w-3.5 text-primary" />
            </div>
            About
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">This tool helps you capture and organise events clearly, as they happen.</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">It does not provide legal advice.</p>
          <p className="text-[11px] text-muted-foreground mt-2">Project Chronicle · v0.1.0</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
