import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, AlertTriangle, RotateCcw, Lock, KeyRound } from 'lucide-react';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PasswordRulesList from '@/components/auth/PasswordRulesList';
import { evaluatePassword, messageForFailedRule, PASSWORD_MESSAGES } from '@/lib/passwordPolicy';
import AuthHero from '@/components/chronicle/AuthHero';
import AuthCard from '@/components/chronicle/AuthCard';


type ResetState = 'verifying' | 'ready' | 'invalid' | 'timeout';

const ResetPasswordScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetState, setResetState] = useState<ResetState>('verifying');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setResetState(prev => prev === 'verifying' ? 'timeout' : prev);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetState('ready');
      }
    });

    // Check if already in recovery state via hash or existing session
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      // Session should be established by Supabase automatically
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setResetState('ready');
        }
      });
    } else {
      // Check if we already have a session (navigated from AuthCallback)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setResetState('ready');
        }
      });
    }

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const passwordCheck = evaluatePassword(password);
  const canSubmit = passwordCheck.valid && password === confirmPassword && !loading;

  const handleUpdate = async () => {
    if (!passwordCheck.valid) {
      toast({
        title: 'Password does not meet requirements',
        description: messageForFailedRule(passwordCheck.failedRule?.id),
        variant: 'destructive',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: PASSWORD_MESSAGES.mismatch, variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast({ title: 'Unable to reset password', description: error.message, variant: 'destructive' });
      return;
    }
    // Critical: clear the recovery session so the user is not left in a
    // partially-authenticated state. Force fresh sign-in with new password.
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setLoading(false);
    toast({ title: 'Password updated', description: 'Sign in with your new password.' });
    navigate('/login', { replace: true });
  };

  if (resetState === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6">
        <ChronicleLogo size={48} />
        <Loader2 className="h-5 w-5 text-primary animate-spin mt-6 mb-2" />
        <p className="text-muted-foreground text-[14px]">Verifying reset link…</p>
      </div>
    );
  }

  if (resetState === 'invalid' || resetState === 'timeout') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 text-center">
        <ChronicleLogo size={48} />
        <AlertTriangle className="h-8 w-8 text-destructive/70 mt-6 mb-3" />
        <p className="text-[14px] text-foreground font-medium mb-1">
          {resetState === 'timeout' ? 'Reset link could not be verified' : 'Invalid or expired reset link'}
        </p>
        <p className="text-[12px] text-muted-foreground mb-4 max-w-[280px]">
          This link may have expired or already been used. Request a new one.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/forgot-password')}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Request new link
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-lg lg:max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-stretch lg:gap-10 lg:px-8 lg:py-10 flex-1">
        <div className="lg:flex-1"><AuthHero /></div>
        <div className="lg:flex-1 lg:max-w-md lg:mx-auto lg:flex lg:items-center"><div className="w-full">

      <AuthCard>
        <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">
          Set a new password
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Choose a strong password to protect your record.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
              New password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-12 pl-10 pr-11 text-[15px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordRulesList password={password} />
          </div>

          <div>
            <Label htmlFor="confirm" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
              <Input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="h-12 pl-10 pr-11 text-[15px]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleUpdate}
            disabled={!canSubmit}
            className="w-full h-[48px] rounded-[10px] text-[14px] font-semibold mt-2"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1.5" strokeWidth={1.75} />}
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </AuthCard>
    </div>
  );
};

export default ResetPasswordScreen;
