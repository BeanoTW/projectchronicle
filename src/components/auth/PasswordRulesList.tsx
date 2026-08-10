import { evaluatePassword } from '@/lib/passwordPolicy';

interface Props {
  password: string;
}

/** Chronicle-styled password checklist. Used by Sign up and Reset password. */
const PasswordRulesList = ({ password }: Props) => {
  const { results } = evaluatePassword(password);
  return (
    <ul className="proto-trust" aria-label="Password requirements" style={{ marginTop: 8 }}>
      {results.map(({ rule, ok }) => (
        <li key={rule.id} style={{ color: ok ? 'var(--p-brass)' : 'var(--p-muted)' }}>
          <span>{rule.label}</span>
          <span className="sr-only">{ok ? ' — met' : ' — not met'}</span>
        </li>
      ))}
    </ul>
  );
};

export default PasswordRulesList;
