import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AuthShell from '@/chronicle/shared/AuthShell';
import { nextOrDefault, withNext } from '@/lib/authNext';
import PasswordRulesList from '@/components/auth/PasswordRulesList';
import {
  evaluatePassword, messageForFailedRule, PASSWORD_MESSAGES,
  canSubmitPassword, checkPasswordBreached, messageForAuthPasswordError,
} from '@/lib/passwordPolicy';
import { usePasswordBreachCheck } from '@/hooks/usePasswordBreachCheck';

const SignupScreen = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const passwordCheck = evaluatePassword(password);
  const breach = usePasswordBreachCheck(password);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const matchState = confirmPassword.length === 0 ? 'idle' : mismatch ? 'mismatch' : 'match';
  const submitBlocked = loading || !canSubmitPassword(password, breach) || mismatch || !email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    if (!email.trim()) { setError('Enter your email address.'); return; }
    if (!passwordCheck.valid) { setError(messageForFailedRule(passwordCheck.failedRule?.id)); return; }
    if (password !== confirmPassword) { setError(PASSWORD_MESSAGES.mismatch); return; }
    if (breach === 'breached') { setError(PASSWORD_MESSAGES.breached); return; }

    setLoading(true);
    // Final authoritative pre-submit check: covers the case where the live
    // check has not finished or was unavailable while typing.
    if (breach !== 'safe') {
      const verdict = await checkPasswordBreached(password);
      if (verdict === 'breached') {
        setLoading(false);
        setError(PASSWORD_MESSAGES.breached);
        return;
      }
    }
    const { error: err, alreadyExists, needsConfirmation } = await signUp(email.trim(), password);
    setLoading(false);

    if (err) {
      const passwordMessage = messageForAuthPasswordError(err as { message?: string; code?: string });
      setError(passwordMessage ?? 'Could not create your account. Please try again.');
      return;
    }
    if (alreadyExists) {
      setError('An account already exists for this email. Log in, or reset your password if you have forgotten it.');
      return;
    }
    if (needsConfirmation) {
      setNotice('Check your email to confirm your account, then log in.');
      return;
    }
    navigate(nextOrDefault(), { replace: true });
  };

  return (
    <AuthShell title="Create account" lede="Chronicle only needs an email address and a password.">
      <form className="proto-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="proto-formerror" role="alert" data-testid="signup-error">{error}</p>}
        {notice && <p className="proto-formnote" role="status" data-testid="signup-notice">{notice}</p>}

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
          <div id="password-rules">
            <PasswordRulesList password={password} breach={breach} match={matchState} />
          </div>
        </div>

        <div className="proto-field">
          <label htmlFor="confirm-password">Confirm password</label>
          <div className="proto-field-row">
            <input
              id="confirm-password"
              className="proto-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          {mismatch && <p className="proto-field-error" role="alert">{PASSWORD_MESSAGES.mismatch}</p>}
        </div>

        <button type="submit" className="proto-btn" data-variant="primary" disabled={submitBlocked} style={{ width: '100%' }}>
          {loading ? 'Creating account…' : breach === 'checking' ? 'Checking password…' : 'Create account'}
        </button>

        <p className="proto-help" style={{ marginTop: 12 }}>
          By creating an account you agree to how Chronicle handles your records, described in our{' '}
          <Link to="/privacy">Privacy notice</Link>.
        </p>

        <div className="proto-authlinks">
          <button type="button" className="proto-linkbtn" onClick={() => navigate(withNext('/login'))}>
            Already have an account? Log in
          </button>
        </div>
      </form>
    </AuthShell>
  );
};

export default SignupScreen;
