import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, AlertTriangle, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PasswordRulesList from '@/components/auth/PasswordRulesList';
import { evaluatePassword, messageForFailedRule, PASSWORD_MESSAGES } from '@/lib/passwordPolicy';

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

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
    <div className="flex flex-col min-h-screen bg-background px-6 max-w-lg mx-auto">
      <div className="pt-[100px]" />

      <motion.div className="flex justify-center" {...fade(0)}>
        <ChronicleLogo size={64} />
      </motion.div>

      <motion.h1
        className="text-[22px] font-bold text-foreground text-center mt-7 tracking-[-0.03em]"
        {...fade(0.1)}
      >
        Set a new password
      </motion.h1>

      <motion.div className="mt-10 space-y-5" {...fade(0.2)}>
        <div>
          <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
            New password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="h-12 rounded-[10px] bg-muted/40 border-border/30 text-[15px] focus:border-primary/30 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordRulesList password={password} />
        </div>
          </Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="h-12 rounded-[10px] bg-muted/40 border-border/30 text-[15px] focus:border-primary/30 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full h-[50px] rounded-[11px] text-[14px] font-semibold bg-primary text-primary-foreground shadow-[0_2px_8px_-3px_hsl(var(--primary)/0.25)] active:scale-[0.97] transition-transform"
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </motion.div>
    </div>
  );
};

export default ResetPasswordScreen;
