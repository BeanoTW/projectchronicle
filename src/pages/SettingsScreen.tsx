import { LogOut, Info, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SettingsScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Logged out' });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Settings</h1>
      </div>

      <div className="px-4 space-y-3">
        {/* Account */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-foreground mb-3">Account</h2>
          <p className="text-[11px] text-muted-foreground mb-1">Logged in as</p>
          <p className="text-sm text-foreground font-medium mb-4">{user?.email}</p>
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive h-10 rounded-xl hover:bg-destructive/5"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" /> Log Out
          </Button>
        </div>

        {/* Data & Privacy */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Data & Privacy
          </h2>
          <div className="space-y-2">
            <p className="text-xs text-body leading-relaxed">Your data is securely stored and linked to your account.</p>
            <p className="text-xs text-body leading-relaxed">You can export your records at any time from the Export tab.</p>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" /> App Info
          </h2>
          <p className="text-xs text-body">Project Chronicle – Early Version</p>
          <p className="text-[11px] text-muted-foreground mt-1">v0.1.0</p>
        </div>

        {/* Footer Notice */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/40">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            This tool supports record-keeping and organisation. It does not provide legal advice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
