// Single source of truth for password rules used across Sign up, Reset, and Change.
//
// The real, enforced policy has two parts:
//   1. Composition rules checked locally (length, letter, number).
//   2. Compromised-password protection enforced by the auth backend: a password
//      that appears in known public breach corpora is rejected outright.
//
// (2) used to be invisible in the UI, which meant the checklist could show all
// green and the account creation still fail. The checklist now includes the
// breach rule, checked live against the Have I Been Pwned range API using
// k-anonymity: only the first five characters of the SHA-1 hash ever leave the
// device, and the full password never does.
//
// All messages are predefined — never generated dynamically, never raw backend text.

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

/** Live status of the compromised-password check. */
export type BreachStatus = 'idle' | 'checking' | 'safe' | 'breached' | 'unavailable';

export const BREACH_RULE_LABEL = 'Not found in a known data breach';

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
  breached:
    'This password has appeared in a known data breach. Please choose a stronger one.',
  checking: 'Checking your password. This takes a moment.',
  // Fallback for any unexpected backend rejection — keep aligned with UI rules.
  doesNotMeet: 'Please meet the password requirements above.',
} as const;

export function messageForFailedRule(ruleId: string | undefined): string {
  switch (ruleId) {
    case 'length': return PASSWORD_MESSAGES.tooShort;
    case 'letter': return PASSWORD_MESSAGES.needsLetter;
    case 'number': return PASSWORD_MESSAGES.needsNumber;
    default: return PASSWORD_MESSAGES.tooShort;
  }
}

/**
 * Maps an auth error to a human-readable message. Raw backend text is never
 * surfaced for password problems, and nothing about the checking mechanism is
 * exposed.
 */
export function messageForAuthPasswordError(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null;
  const code = (error.code ?? '').toLowerCase();
  const msg = (error.message ?? '').toLowerCase();
  const weak =
    code === 'weak_password' ||
    msg.includes('weak') || msg.includes('pwned') || msg.includes('breach') || msg.includes('compromis') ||
    msg.includes('easy to guess');
  if (weak) return PASSWORD_MESSAGES.breached;
  return null;
}

const sha1Hex = async (value: string): Promise<string | null> => {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!subtle) return null;
  const bytes = new TextEncoder().encode(value);
  const digest = await subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

const breachCache = new Map<string, BreachStatus>();

/**
 * Checks a password against the public breach corpus using k-anonymity.
 * Returns 'unavailable' (never a blocking failure) when the check cannot run —
 * the backend remains the authority in that case.
 */
export async function checkPasswordBreached(password: string, signal?: AbortSignal): Promise<BreachStatus> {
  if (!password) return 'idle';
  const cached = breachCache.get(password);
  if (cached) return cached;
  try {
    const hash = await sha1Hex(password);
    if (!hash) return 'unavailable';
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal,
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return 'unavailable';
    const body = await res.text();
    const found = body.split('\n').some(line => {
      const [hashSuffix, count] = line.trim().split(':');
      return hashSuffix === suffix && Number(count ?? 0) > 0;
    });
    const status: BreachStatus = found ? 'breached' : 'safe';
    breachCache.set(password, status);
    return status;
  } catch {
    return 'unavailable';
  }
}

/** True when the form may be submitted: composition met and not known-breached. */
export function canSubmitPassword(pw: string, breach: BreachStatus): boolean {
  if (!evaluatePassword(pw).valid) return false;
  return breach !== 'breached' && breach !== 'checking';
}
