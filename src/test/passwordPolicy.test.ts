import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  evaluatePassword, canSubmitPassword, checkPasswordBreached,
  messageForAuthPasswordError, PASSWORD_MESSAGES,
} from '@/lib/passwordPolicy';

afterEach(() => { vi.restoreAllMocks(); });

describe('password policy', () => {
  it('keeps the existing composition rules', () => {
    expect(evaluatePassword('short1').valid).toBe(false);
    expect(evaluatePassword('abcdefgh').valid).toBe(false);
    expect(evaluatePassword('12345678').valid).toBe(false);
    expect(evaluatePassword('Chronicle24').valid).toBe(true);
  });

  it('blocks submission while the breach check is running or has failed the password', () => {
    expect(canSubmitPassword('Chronicle24', 'checking')).toBe(false);
    expect(canSubmitPassword('Chronicle24', 'breached')).toBe(false);
    expect(canSubmitPassword('Chronicle24', 'safe')).toBe(true);
    // Unavailable must not lock a user out — the backend stays authoritative.
    expect(canSubmitPassword('Chronicle24', 'unavailable')).toBe(true);
  });

  it('detects a breached password without sending the password anywhere', async () => {
    // SHA-1('@Project88') = 0FDF6...; only the 5-char prefix must be requested.
    let requested = '';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requested = url;
      const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode('@Project88'));
      const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      return { ok: true, text: async () => `${hash.slice(5)}:42\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1` } as Response;
    }));
    const status = await checkPasswordBreached('@Project88');
    expect(status).toBe('breached');
    expect(requested).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/);
    expect(requested).not.toContain('Project88');
  });

  it('reports safe when the corpus has no match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'ABC:1' } as Response)));
    expect(await checkPasswordBreached('Chronicle-unique-24')).toBe('safe');
  });

  it('degrades to unavailable when the check cannot run', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await checkPasswordBreached('Chronicle-offline-24')).toBe('unavailable');
  });

  it('translates the backend weak-password rejection into plain language', () => {
    expect(messageForAuthPasswordError({ code: 'weak_password', message: 'Password is known to be weak and easy to guess' }))
      .toBe(PASSWORD_MESSAGES.breached);
    expect(messageForAuthPasswordError({ message: 'Network error' })).toBeNull();
  });
});
