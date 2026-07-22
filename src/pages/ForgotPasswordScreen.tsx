import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthHero from '@/components/chronicle/AuthHero';
import AuthCard from '@/components/chronicle/AuthCard';

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
      toast({
        title: 'Could not send reset link',
        description: error.message || 'Please check your connection and try again.',
        variant: 'destructive',
      });
      return;
    }
    setSent(true);
    toast({
      title: 'Request received',
      description: 'If an account exists for this email, a reset link will arrive shortly.',
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-lg lg:max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-stretch lg:gap-10 lg:px-8 lg:py-10 flex-1">
        <div className="lg:flex-1"><AuthHero /></div>
        <div className="lg:flex-1 lg:max-w-md lg:mx-auto lg:flex lg:items-center"><div className="w-full">

      <AuthCard>
        <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">
          Reset your password
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
          Enter your email and we'll send a reset link if an account exists.
        </p>

        {sent ? (
          <div className="mt-6 text-center space-y-3">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <p className="text-[14px] text-foreground font-medium">Check your inbox</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              If an account exists, a reset link will be sent. Follow the link to set a new password.
            </p>
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="w-full h-[46px] rounded-[10px] text-[14px] font-semibold mt-2"
            >
              Back to sign in
            </Button>
          </div>
        ) : (
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

            <Button
              onClick={handleReset}
              disabled={loading}
              className="w-full h-[48px] rounded-[10px] text-[14px] font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" strokeWidth={1.75} />}
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>

            <div className="text-center pt-1">
              <button
                onClick={() => navigate('/login')}
                className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to <span className="text-primary font-medium">sign in</span>
              </button>
            </div>
          </div>
        )}
      </AuthCard>
      </div></div>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
