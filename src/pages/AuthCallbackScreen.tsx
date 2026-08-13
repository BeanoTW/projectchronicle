import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import ChronicleLogo from '@/components/chronicle/ChronicleLogo';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { nextOrDefault } from '@/lib/authNext';

type CallbackState = 'processing' | 'success' | 'error' | 'timeout';

const AuthCallbackScreen = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>('processing');
  const [flowType, setFlowType] = useState<string>('unknown');
  const [errorMessage, setErrorMessage] = useState('');
  // Intended destination carried through the email round-trip. Validated by
  // `nextOrDefault`, which only ever returns a real internal Chronicle route.
  const destination = nextOrDefault();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setState(prev => prev === 'processing' ? 'timeout' : prev);
    }, 15000);

    const handleCallback = async () => {
      try {
        // Parse hash fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const type = params.get('type') || '';
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorParam) {
          setFlowType(type || 'callback');
          setErrorMessage(errorDescription || errorParam || 'Authentication failed');
          setState('error');
          return;
        }

        // Detect flow type
        if (type === 'recovery') {
          setFlowType('recovery');
          // Let the auth state change listener handle session establishment
          // Then redirect to reset password screen
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
              subscription.unsubscribe();
              navigate('/reset-password', { replace: true });
            }
          });
          // Also check if session is already established
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            subscription.unsubscribe();
            navigate('/reset-password', { replace: true });
          }
          return;
        }

        if (type === 'signup' || type === 'email') {
          setFlowType('verification');
          // Wait for session to be established
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            if (session.user.email_confirmed_at) {
              setState('success');
              setTimeout(() => navigate(destination, { replace: true }), 1500);
            } else {
              setErrorMessage('Email verification could not be confirmed. Try signing in.');
              setState('error');
            }
          } else {
            // Listen for auth state change
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
              if (session?.user?.email_confirmed_at) {
                subscription.unsubscribe();
                setState('success');
                setTimeout(() => navigate(destination, { replace: true }), 1500);
              }
            });
            // Timeout will handle if nothing happens
          }
          return;
        }

        // Generic sign-in callback or unknown type
        setFlowType(type || 'sign-in');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setState('success');
          setTimeout(() => navigate(destination, { replace: true }), 1000);
        } else {
          // Wait briefly for auth state
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
              subscription.unsubscribe();
              setState('success');
              setTimeout(() => navigate(destination, { replace: true }), 1000);
            }
          });
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
        setState('error');
      }
    };

    handleCallback();
    return () => clearTimeout(timeout);
  }, [navigate, destination]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6">
      <ChronicleLogo size={48} />

      {state === 'processing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 flex flex-col items-center">
          <Loader2 className="h-6 w-6 text-primary animate-spin mb-3" />
          <p className="text-[14px] text-foreground font-medium">
            {flowType === 'recovery' ? 'Preparing password reset…' :
             flowType === 'verification' ? 'Confirming your email…' :
             'Completing sign-in…'}
          </p>
        </motion.div>
      )}

      {state === 'success' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 flex flex-col items-center">
          <CheckCircle2 className="h-8 w-8 text-primary mb-3" />
          <p className="text-[14px] text-foreground font-medium">
            {flowType === 'verification' ? 'Email verified' : 'Signed in'}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">Redirecting…</p>
        </motion.div>
      )}

      {state === 'error' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col items-center text-center max-w-[300px]">
          <AlertTriangle className="h-8 w-8 text-destructive/70 mb-3" />
          <p className="text-[14px] text-foreground font-medium mb-1">
            {flowType === 'recovery' ? 'Invalid or expired reset link' :
             flowType === 'verification' ? 'Verification failed' :
             'Authentication failed'}
          </p>
          <p className="text-[12px] text-muted-foreground mb-4">{errorMessage}</p>
          <div className="flex gap-2">
            {flowType === 'recovery' && (
              <Button variant="outline" size="sm" onClick={() => navigate('/forgot-password')}>
                Request new link
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          </div>
        </motion.div>
      )}

      {state === 'timeout' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col items-center text-center max-w-[300px]">
          <RotateCcw className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-[14px] text-foreground font-medium mb-1">This is taking longer than expected</p>
          <p className="text-[12px] text-muted-foreground mb-4">The link may be invalid or expired.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AuthCallbackScreen;
