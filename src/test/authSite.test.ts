import { describe, it, expect } from 'vitest';
import { authSiteOrigin, PRODUCTION_ORIGIN } from '@/lib/authSite';

describe('auth email link origin', () => {
  it('uses the production domain from a Lovable preview host', () => {
    expect(authSiteOrigin('https://id-preview--abc.lovable.app', 'id-preview--abc.lovable.app'))
      .toBe(PRODUCTION_ORIGIN);
  });

  it('uses the production domain from the published app', () => {
    expect(authSiteOrigin('https://www.projectchronicle.app', 'www.projectchronicle.app'))
      .toBe(PRODUCTION_ORIGIN);
  });

  it('keeps local development links local', () => {
    expect(authSiteOrigin('http://localhost:8080', 'localhost')).toBe('http://localhost:8080');
  });
});
