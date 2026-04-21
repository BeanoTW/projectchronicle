import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, LogIn, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AuthHero from '@/components/chronicle/AuthHero';
import AuthCard from '@/components/chronicle/AuthCard';

const LoginScreen = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Unable to sign in', description: 'Invalid login details.', variant: 'destructive' });
    } else {
      navigate('/home');
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      <AuthHero />

      <AuthCard>
        <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">
          Welcome back.
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Sign in to continue your record.
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
            <div className="flex justify-end mt-1.5">
              <button
                onClick={() => navigate('/forgot-password')}
                className="text-[12px] text-primary/90 font-medium hover:text-primary transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-[48px] rounded-[10px] text-[14px] font-semibold mt-2"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-1.5" strokeWidth={1.75} />}
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            onClick={() => navigate('/signup')}
            variant="outline"
            className="w-full h-[48px] rounded-[10px] text-[14px] font-semibold"
          >
            Create an account
          </Button>
        </div>
      </AuthCard>
    </div>
  );
};

export default LoginScreen;
