import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthShell from '@/chronicle/shared/AuthShell';

const LoginScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: err, reason } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(
        reason === 'email_not_confirmed'
          ? 'Confirm your email address first. Check your inbox for the confirmation link.'
          : reason === 'invalid_credentials'
          ? 'Email or password not recognised.'
          : err.message || 'Could not log you in. Please try again.',
      );
      return;
    }
    // Return the user to the route they originally attempted; otherwise Notebook.
    if (safeNext) window.location.href = safeNext;
    else navigate('/timeline', { replace: true });
  };

  return (
    <AuthShell title="Log in" lede="Continue your record.">
      <form className="proto-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p className="proto-formerror" role="alert" data-testid="login-error">{error}</p>
        )}

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

        <div className="proto-field">
          <label htmlFor="password">Password</label>
          <div className="proto-field-row">
            <input
              id="password"
              className="proto-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
        </div>

        <button type="submit" className="proto-btn" data-variant="primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        <div className="proto-authlinks">
          <button type="button" className="proto-linkbtn" onClick={() => navigate('/forgot-password')}>
            Forgotten password
          </button>
          <button type="button" className="proto-linkbtn" onClick={() => navigate('/signup')}>
            Create account
          </button>
        </div>
      </form>
    </AuthShell>
  );
};

export default LoginScreen;
