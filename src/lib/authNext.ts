/**
 * Post-authentication redirect target.
 *
 * A signed-out visit to a protected route lands on `/?next=/incident/123`.
 * The welcome and auth screens must carry that `next` with them, otherwise the
 * user signs in and is dropped on the Notebook instead of the page they asked
 * for.
 */

/** Only same-origin absolute paths are ever honoured. */
export const safeNextPath = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  // Reject protocol-relative (`//evil.com`) and backslash-normalised variants.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
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
export const DEFAULT_AFTER_AUTH = '/timeline';

/** Where to send a user after successful authentication. */
export const nextOrDefault = (
  search = typeof window === 'undefined' ? '' : window.location.search,
): string => currentNext(search) ?? DEFAULT_AFTER_AUTH;

/** Builds the signed-out landing URL that remembers where the user was going. */
export const authRedirectFor = (intended: string): string => {
  const safe = safeNextPath(intended);
  return safe && safe !== '/' ? `/?next=${encodeURIComponent(safe)}` : '/';
};

