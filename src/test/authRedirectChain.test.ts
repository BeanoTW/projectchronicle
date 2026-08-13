import { describe, it, expect } from 'vitest';
import {
  safeNextPath, currentNext, withNext, nextOrDefault, authRedirectFor,
  callbackPathWithNext, DEFAULT_AFTER_AUTH,
} from '@/lib/authNext';
import { authSiteOrigin, PRODUCTION_ORIGIN } from '@/lib/authSite';

// jsdom runs on localhost, where auth links intentionally stay local. Build the
// production URL the way the app does, with the production host supplied.
const emailUrl = (path: string) =>
  `${authSiteOrigin('https://www.projectchronicle.app', 'www.projectchronicle.app')}${path}`;

describe('safe next destinations', () => {
  it('accepts real internal Chronicle routes', () => {
    ['/home', '/timeline', '/record', '/incident/abc-123', '/export', '/settings', '/support']
      .forEach(p => expect(safeNextPath(p)).toBe(p));
  });

  it('rejects external and malformed destinations', () => {
    [
      'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)',
      '/\u0000/home', 'timeline', '', null, undefined, '/unknown-route', '/login',
    ].forEach(v => expect(safeNextPath(v as string)).toBeNull());
  });

  it('keeps query strings on allowed routes', () => {
    expect(safeNextPath('/timeline?view=month')).toBe('/timeline?view=month');
  });
});

describe('redirect chain', () => {
  it('protected route → signed-out landing carries next', () => {
    expect(authRedirectFor('/incident/abc')).toBe('/?next=%2Fincident%2Fabc');
  });

  it('landing → auth screens carry next', () => {
    expect(withNext('/signup', '?next=%2Fincident%2Fabc')).toBe('/signup?next=%2Fincident%2Fabc');
  });

  it('signup → confirmation email callback carries next on the production origin', () => {
    const path = callbackPathWithNext('?next=%2Fincident%2Fabc');
    expect(path).toBe('/auth/callback?next=%2Fincident%2Fabc');
    expect(emailUrl(path)).toBe(`${PRODUCTION_ORIGIN}/auth/callback?next=%2Fincident%2Fabc`);
  });

  it('callback → intended route', () => {
    expect(nextOrDefault('?next=%2Fincident%2Fabc')).toBe('/incident/abc');
  });

  it('falls back to Home when there is no safe destination', () => {
    expect(DEFAULT_AFTER_AUTH).toBe('/home');
    expect(nextOrDefault('')).toBe('/home');
    expect(nextOrDefault('?next=https://evil.example')).toBe('/home');
    expect(callbackPathWithNext('?next=https://evil.example')).toBe('/auth/callback');
    expect(currentNext('?next=//evil.example')).toBeNull();
  });

  it('never emits an off-origin absolute URL from an unsafe next', () => {
    const url = emailUrl(callbackPathWithNext('?next=https%3A%2F%2Fevil.example'));
    expect(url.startsWith(PRODUCTION_ORIGIN)).toBe(true);
  });
});
