import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Mail, Lock, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import PasswordRulesList from '@/components/auth/PasswordRulesList';
import { evaluatePassword, messageForFailedRule, PASSWORD_MESSAGES } from '@/lib/passwordPolicy';
import AuthHero from '@/components/chronicle/AuthHero';
import AuthCard from '@/components/chronicle/AuthCard';

const SignupScreen = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordCheck = evaluatePassword(password);
  const canSubmit =
    !!email.trim() && passwordCheck.valid && password === confirmPassword && !loading;

  const handleSignup = async () => {
    if (!email.trim() || !password) return;
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
    const { error, alreadyExists, needsConfirmation } = await signUp(email.trim(), password);
    setLoading(false);
    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      const isWeakPassword =
        msg.includes('weak') || msg.includes('pwned') || msg.includes('breach') || msg.includes('compromis');
      toast({
        title: 'Sign up failed',
        description: isWeakPassword ? PASSWORD_MESSAGES.doesNotMeet : error.message,
        variant: 'destructive',
      });
      return;
    }
    if (alreadyExists) {
      toast({
        title: 'Account already exists',
        description: 'Try signing in, or reset your password if you’ve forgotten it.',
      });
      navigate('/login');
      return;
    }
    if (needsConfirmation) {
      toast({
        title: 'Check your email',
        description: 'Check your email to confirm your account before signing in.',
      });
      navigate('/login');
      return;
    }
    // Session was created immediately (auto-confirm enabled)
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-lg lg:max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-stretch lg:gap-10 lg:px-8 lg:py-10 flex-1">
        <div className="lg:flex-1"><AuthHero /></div>
        <div className="lg:flex-1 lg:max-w-md lg:mx-auto lg:flex lg:items-center"><div className="w-full">

      <AuthCard>
        <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">
          Create your account.
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Start your record in minutes.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 pl-10 text-[15px]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
              Password
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
            <Label htmlFor="confirm-password" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
              <Input
                id="confirm-password"
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
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-[12px] text-destructive mt-1.5" role="alert">
                {PASSWORD_MESSAGES.mismatch}
              </p>
            )}
          </div>

          <Button
            onClick={handleSignup}
            disabled={!canSubmit}
            className="w-full h-[48px] rounded-[10px] text-[14px] font-semibold mt-2"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1.5" strokeWidth={1.75} />}
            {loading ? 'Creating account…' : 'Create account'}
          </Button>

          <div className="text-center pt-1">
            <button
              onClick={() => navigate('/login')}
              className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account?{' '}
              <span className="text-primary font-medium">Sign in</span>
            </button>
          </div>
        </div>
      </AuthCard>
      </div></div>
      </div>
    </div>
  );
};

export default SignupScreen;
