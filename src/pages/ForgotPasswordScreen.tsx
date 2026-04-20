import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

const ForgotPasswordScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      // Do NOT claim the email was sent if the request failed.
      toast({
        title: 'Could not send reset link',
        description: error.message || 'Please check your connection and try again.',
        variant: 'destructive',
      });
      return;
    }
    setSent(true);
    // Neutral wording — does not confirm or deny the account exists.
    toast({
      title: 'Request received',
      description: 'If an account exists for this email, a reset link will arrive shortly.',
    });
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
        Reset your password
      </motion.h1>

      <motion.p
        className="text-[13px] text-muted-foreground text-center mt-2 max-w-[280px] mx-auto leading-relaxed"
        {...fade(0.15)}
      >
        Enter your email and we'll send a reset link if an account exists.
      </motion.p>

      {sent ? (
        <motion.div className="mt-10 text-center space-y-4" {...fade(0.2)}>
          <p className="text-[14px] text-foreground font-medium">If an account exists, a reset link will be sent.</p>
          <p className="text-[13px] text-muted-foreground">Check your email, then follow the link to set a new password.</p>
          <button
            onClick={() => navigate('/login')}
            className="text-[13px] text-primary font-medium hover:text-primary/80 transition-colors"
          >
            Back to sign in
          </button>
        </motion.div>
      ) : (
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

          <Button
            onClick={handleReset}
            disabled={loading}
            className="w-full h-[50px] rounded-[11px] text-[14px] font-semibold bg-primary text-primary-foreground shadow-[0_2px_8px_-3px_hsl(var(--primary)/0.25)] active:scale-[0.97] transition-transform"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </motion.div>
      )}

      <motion.div className="mt-8 text-center" {...fade(0.3)}>
        <button
          onClick={() => navigate('/login')}
          className="text-[13px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors"
        >
          Back to sign in
        </button>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordScreen;
