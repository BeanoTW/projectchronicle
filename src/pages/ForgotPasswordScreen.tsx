import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AuthShell from '@/chronicle/shared/AuthShell';
import { authRedirectUrl } from '@/lib/authSite';

const ForgotPasswordScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message || 'Could not send the reset link. Check your connection and try again.');
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      title="Forgotten password"
      lede="Enter your email and we will send a reset link if an account exists."
    >
      {sent ? (
        <div className="proto-form">
          <p className="proto-formnote" role="status">
            If an account exists for that email, a reset link is on its way. Follow the link to set a new password.
          </p>
          <button type="button" className="proto-btn" style={{ width: '100%' }} onClick={() => navigate('/login')}>
            Back to log in
          </button>
        </div>
      ) : (
        <form className="proto-form" onSubmit={handleSubmit} noValidate>
          {error && <p className="proto-formerror" role="alert">{error}</p>}
          <div className="proto-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="proto-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="proto-btn" data-variant="primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <div className="proto-authlinks">
            <button type="button" className="proto-linkbtn" onClick={() => navigate('/login')}>
              Back to log in
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPasswordScreen;
