import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AuthShell from '@/chronicle/shared/AuthShell';
import PasswordRulesList from '@/components/auth/PasswordRulesList';
import { evaluatePassword, messageForFailedRule, PASSWORD_MESSAGES } from '@/lib/passwordPolicy';

type ResetState = 'verifying' | 'ready' | 'invalid' | 'timeout' | 'done';

const ResetPasswordScreen = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<ResetState>('verifying');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setResetState(prev => (prev === 'verifying' ? 'timeout' : prev));
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setResetState('ready');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setResetState(prev => (prev === 'verifying' ? 'ready' : prev));
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const passwordCheck = evaluatePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!passwordCheck.valid) { setError(messageForFailedRule(passwordCheck.failedRule?.id)); return; }
    if (password !== confirmPassword) { setError(PASSWORD_MESSAGES.mismatch); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setLoading(false);
      setError(err.message || 'Could not update your password. Please try again.');
      return;
    }
    // Clear the recovery session so the user re-authenticates with the new password.
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setLoading(false);
    setResetState('done');
  };

  if (resetState === 'verifying') {
    return (
      <AuthShell title="Reset password" lede="Checking your reset link…">
        <p className="proto-help" role="status">One moment.</p>
      </AuthShell>
    );
  }

  if (resetState === 'invalid' || resetState === 'timeout') {
    return (
      <AuthShell
        title="Reset link not valid"
        lede="This link may have expired or already been used. You can request a new one."
      >
        <div className="proto-auth-actions">
          <button type="button" className="proto-btn" data-variant="primary" onClick={() => navigate('/forgot-password')}>
            Request a new link
          </button>
          <button type="button" className="proto-btn" onClick={() => navigate('/login')}>
            Back to log in
          </button>
        </div>
      </AuthShell>
    );
  }

  if (resetState === 'done') {
    return (
      <AuthShell title="Password updated" lede="You can now log in with your new password.">
        <button type="button" className="proto-btn" data-variant="primary" style={{ width: '100%' }} onClick={() => navigate('/login', { replace: true })}>
          Go to log in
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" lede="Choose a password you have not used elsewhere.">
      <form className="proto-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="proto-formerror" role="alert">{error}</p>}

        <div className="proto-field">
          <label htmlFor="password">New password</label>
          <div className="proto-field-row">
            <input
              id="password"
              className="proto-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-describedby="password-rules"
            />
            <button
              type="button"
              className="proto-reveal"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(v => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div id="password-rules"><PasswordRulesList password={password} /></div>
        </div>

        <div className="proto-field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            className="proto-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="proto-btn" data-variant="primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordScreen;
