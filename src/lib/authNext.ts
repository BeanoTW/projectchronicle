/**
 * Post-authentication redirect target.
 *
 * A signed-out visit to a protected route lands on `/?next=/incident/123`.
 * The welcome and auth screens must carry that `next` with them, otherwise the
 * user signs in and is dropped on Home instead of the page they asked for.
 *
 * The same `next` also has to survive the email round-trip:
 *   protected route → / → signup → confirmation email → /auth/callback → app
 * so it is appended to the emailed callback URL as a query parameter.
 */

/** Routes a `next` value is allowed to resolve to. Anything else falls back. */
const ALLOWED_PREFIXES = [
  '/home',
  '/timeline',
  '/record',
  '/incident/',
  '/export',
  '/attachments',
  '/evidence',
  '/support',
  '/settings',
];

/** Only same-origin absolute paths pointing at real Chronicle routes are honoured. */
export const safeNextPath = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  // Reject protocol-relative (`//evil.com`) and backslash-normalised variants.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // Reject anything carrying a scheme, control characters or a fragment jump.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (raw.includes('\\')) return null;
  const path = raw.split('?')[0].split('#')[0];
  const allowed = ALLOWED_PREFIXES.some(p => (p.endsWith('/') ? path.startsWith(p) : path === p));
  if (!allowed) return null;
  return raw;
};

/** Reads a safe `next` from the current URL. */
export const currentNext = (search = typeof window === 'undefined' ? '' : window.location.search): string | null =>
  safeNextPath(new URLSearchParams(search).get('next'));

/** Appends the active `next` to an internal path so it survives navigation. */
export const withNext = (
  path: string,
  search = typeof window === 'undefined' ? '' : window.location.search,
): string => {
  const next = currentNext(search);
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
};

/** Default landing surface when there is no safe return-to target. */
export const DEFAULT_AFTER_AUTH = '/home';

/** Where to send a user after successful authentication. */
export const nextOrDefault = (
  search = typeof window === 'undefined' ? '' : window.location.search,
): string => currentNext(search) ?? DEFAULT_AFTER_AUTH;

/** Builds the signed-out landing URL that remembers where the user was going. */
export const authRedirectFor = (intended: string): string => {
  const safe = safeNextPath(intended);
  return safe && safe !== '/' ? `/?next=${encodeURIComponent(safe)}` : '/';
};

/**
 * Path (with query) that an auth email should return the user to.
 * The `next` value is validated before it is embedded, so a hostile value can
 * never travel through the email round-trip.
 */
export const callbackPathWithNext = (
  search = typeof window === 'undefined' ? '' : window.location.search,
): string => {
  const next = currentNext(search);
  return next ? `/auth/callback?next=${encodeURIComponent(next)}` : '/auth/callback';
};
