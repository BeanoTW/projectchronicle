import { evaluatePassword, BREACH_RULE_LABEL, type BreachStatus } from '@/lib/passwordPolicy';

interface Props {
  password: string;
  /** Live compromised-password status. Shown as a real requirement, because
   *  the backend enforces it and will otherwise reject an all-green password. */
  breach?: BreachStatus;
  /** Confirmation field state, so matching is obvious before submission. */
  match?: 'idle' | 'match' | 'mismatch';
}

const tone = (state: 'ok' | 'pending' | 'fail' | 'idle') => {
  if (state === 'ok') return 'var(--p-brass)';
  if (state === 'fail') return 'var(--p-danger, #b3261e)';
  return 'var(--p-muted)';
};

/** Chronicle-styled password checklist. Used by Sign up and Reset password. */
const PasswordRulesList = ({ password, breach = 'idle', match = 'idle' }: Props) => {
  const { results } = evaluatePassword(password);

  const breachState: 'ok' | 'pending' | 'fail' | 'idle' =
    breach === 'safe' ? 'ok'
    : breach === 'breached' ? 'fail'
    : breach === 'checking' ? 'pending'
    : 'idle';

  const breachLabel =
    breach === 'checking' ? 'Checking against known data breaches…'
    : breach === 'breached' ? 'This password has appeared in a known data breach. Please choose a stronger one.'
    : breach === 'unavailable' ? 'Breach check unavailable — it will be checked when you continue'
    : BREACH_RULE_LABEL;

  return (
    <ul className="proto-trust" aria-label="Password requirements" aria-live="polite" style={{ marginTop: 8 }}>
      {results.map(({ rule, ok }) => (
        <li key={rule.id} style={{ color: tone(ok ? 'ok' : 'idle') }}>
          <span>{rule.label}</span>
          <span className="sr-only">{ok ? ' — met' : ' — not met'}</span>
        </li>
      ))}
      <li style={{ color: tone(breachState) }} data-testid="password-breach-rule">
        <span>{breachLabel}</span>
      </li>
      {match !== 'idle' && (
        <li style={{ color: tone(match === 'match' ? 'ok' : 'fail') }} data-testid="password-match-rule">
          <span>{match === 'match' ? 'Both passwords match' : 'Passwords do not match yet'}</span>
        </li>
      )}
    </ul>
  );
};

export default PasswordRulesList;
