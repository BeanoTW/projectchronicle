import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthShell from '@/chronicle/shared/AuthShell';
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

  const callbackTitle =
    state === 'processing'
      ? flowType === 'recovery'
        ? 'Preparing password reset'
        : flowType === 'verification'
          ? 'Confirming your email'
          : 'Completing sign-in'
      : state === 'success'
        ? flowType === 'verification'
          ? 'Email verified'
          : 'Signed in'
        : state === 'timeout'
          ? 'This is taking longer than expected'
          : flowType === 'recovery'
            ? 'Reset link could not be used'
            : flowType === 'verification'
              ? 'Email could not be verified'
              : 'Sign-in could not be completed';

  const callbackLede =
    state === 'processing'
      ? 'Chronicle is securely checking the link.'
      : state === 'success'
        ? 'Everything is ready. Taking you back to your record.'
        : 'Your Chronicle data has not been changed.';

  return (
    <AuthShell title={callbackTitle} lede={callbackLede}>
      <div className="mt-7">
        {state === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-card/70 px-4 py-4"
            role="status"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              <p className="text-[13px] text-muted-foreground">Please keep this page open.</p>
            </div>
          </motion.div>
        )}

        {state === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-4"
            role="status"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
              <p className="text-[13px] text-foreground">Redirecting to Chronicle…</p>
            </div>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="proto-form">
            <p className="proto-formerror" role="alert">
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage || 'The link may be invalid or expired.'}</span>
              </span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {flowType === 'recovery' && (
                <Button variant="outline" onClick={() => navigate('/forgot-password')}>
                  Request new link
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/login')}>
                Back to sign in
              </Button>
            </div>
          </motion.div>
        )}

        {state === 'timeout' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="proto-form">
            <div className="rounded-xl border border-border bg-card/70 px-4 py-4">
              <div className="flex items-start gap-3">
                <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  The link may be invalid or expired. You can retry safely or return to sign in.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
              <Button variant="outline" onClick={() => navigate('/login')}>
                Back to sign in
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </AuthShell>
  );
};

export default AuthCallbackScreen;
