/**
 * Canonical origin used inside authentication emails.
 *
 * Confirmation, magic-link and password-reset links must land on Chronicle's
 * own domain — never on a Lovable preview host, which is temporary and which
 * users have no reason to trust. Local development keeps its own origin so the
 * flows stay testable on a dev machine.
 */
export const PRODUCTION_ORIGIN = 'https://projectchronicle.app';

const isLocalHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');

/** Origin that auth email links should point at. */
export const authSiteOrigin = (
  origin = typeof window === 'undefined' ? PRODUCTION_ORIGIN : window.location.origin,
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
): string => (isLocalHost(hostname) ? origin : PRODUCTION_ORIGIN);

/** Absolute auth-email destination for an internal path (e.g. `/auth/callback`). */
export const authRedirectUrl = (path: string): string => `${authSiteOrigin()}${path}`;
