import { Check, Circle } from 'lucide-react';
import { evaluatePassword } from '@/lib/passwordPolicy';

interface Props {
  password: string;
}

const PasswordRulesList = ({ password }: Props) => {
  const { results } = evaluatePassword(password);
  return (
    <ul className="space-y-1 mt-1.5" aria-label="Password requirements">
      {results.map(({ rule, ok }) => (
        <li
          key={rule.id}
          className={`flex items-center gap-2 text-[12px] transition-colors ${
            ok ? 'text-primary' : 'text-muted-foreground/70'
          }`}
        >
          {ok ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          ) : (
            <Circle className="h-3 w-3" strokeWidth={2} />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
};

export default PasswordRulesList;
