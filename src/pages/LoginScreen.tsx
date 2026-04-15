import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

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
    <div className="flex flex-col min-h-screen bg-background px-6 max-w-lg mx-auto">
      <div className="pt-[100px]" />

      <motion.div className="flex justify-center" {...fade(0)}>
        <ChronicleLogo size={64} />
      </motion.div>

      <motion.h1
        className="text-[22px] font-bold text-foreground text-center mt-7 tracking-[-0.03em]"
        {...fade(0.1)}
      >
        Welcome back.
      </motion.h1>

      <motion.div className="mt-10 space-y-5" {...fade(0.2)}>
        <div>
          <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12 rounded-[10px] bg-muted/40 border-border/30 text-[15px] focus:border-primary/30"
          />
        </div>
        <div>
          <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
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
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => navigate('/forgot-password')}
            className="text-[12px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <Button
          onClick={handleLogin}
          disabled={loading}
          className="w-full h-[50px] rounded-[11px] text-[14px] font-semibold bg-primary text-primary-foreground shadow-[0_2px_8px_-3px_hsl(var(--primary)/0.25)] active:scale-[0.97] transition-transform"
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </motion.div>

      <motion.div className="mt-8 text-center" {...fade(0.3)}>
        <button
          onClick={() => navigate('/signup')}
          className="text-[13px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors"
        >
          Create an account
        </button>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
