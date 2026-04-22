// Single source of truth for password rules used across Sign up, Reset, and Change.
// The visible UI checklist is the ONLY validation enforced. No hidden backend
// checks (HIBP / common-password rejection) are applied.
// All messages are predefined — never generated dynamically.

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'letter', label: 'Contains a letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'Contains a number', test: (p) => /\d/.test(p) },
];

export interface PasswordEvaluation {
  valid: boolean;
  failedRule: PasswordRule | null;
  results: Array<{ rule: PasswordRule; ok: boolean }>;
}

export function evaluatePassword(pw: string): PasswordEvaluation {
  const results = PASSWORD_RULES.map((rule) => ({ rule, ok: rule.test(pw) }));
  const failed = results.find((r) => !r.ok);
  return {
    valid: !failed,
    failedRule: failed?.rule ?? null,
    results,
  };
}

// Predefined messages — do not infer or generate.
export const PASSWORD_MESSAGES = {
  tooShort: 'Password must be at least 8 characters.',
  needsLetter: 'Password must contain at least one letter.',
  needsNumber: 'Password must contain at least one number.',
  mismatch: 'Passwords do not match.',
  // Backend (HIBP) — surfaced verbatim from Supabase if returned.
  leaked: 'This password has appeared in a known data breach. Choose a different one.',
} as const;

export function messageForFailedRule(ruleId: string | undefined): string {
  switch (ruleId) {
    case 'length': return PASSWORD_MESSAGES.tooShort;
    case 'letter': return PASSWORD_MESSAGES.needsLetter;
    case 'number': return PASSWORD_MESSAGES.needsNumber;
    default: return PASSWORD_MESSAGES.tooShort;
  }
}
