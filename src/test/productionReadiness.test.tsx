/**
 * Production-readiness regression suite.
 *
 * Covers the invariants that must not silently regress:
 *  - safe return-to-target auth redirects (open-redirect resistance)
 *  - the render error boundary keeps the app usable
 *  - the central upload policy cannot be bypassed
 *  - local account-boundary isolation (A's cache is not readable by B, and
 *    unsynced rows are never silently deleted)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import 'fake-indexeddb/auto';

import { safeNextPath, currentNext, withNext, nextOrDefault, authRedirectFor } from '@/lib/authNext';
import { AppErrorBoundary, ScreenErrorBoundary } from '@/components/ErrorBoundary';
import {
  checkUploadAllowed,
  assertUploadAllowed,
  safeExtension,
  safeDisplayName,
  MAX_UPLOAD_BYTES,
  MAX_ATTACHMENTS_PER_RECORD,
} from '@/lib/uploadPolicy';
import { localDB } from '@/local/db';
import { applyAccountBoundary, countUnsyncedFor, restoreQuarantine } from '@/local/accountBoundary';

// ---------------------------------------------------------------- auth next

describe('auth return-to-target', () => {
  it('accepts a valid internal path', () => {
    expect(safeNextPath('/incident/abc')).toBe('/incident/abc');
    expect(currentNext('?next=%2Fincident%2Fabc')).toBe('/incident/abc');
  });

  it('accepts an encoded path with a query string', () => {
    expect(currentNext('?next=%2Ftimeline%3Fq%3Dmarch%26view%3Dmonth')).toBe('/timeline?q=march&view=month');
  });

  it('rejects external and protocol-relative targets', () => {
    expect(safeNextPath('https://evil.example/steal')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(currentNext('?next=https%3A%2F%2Fevil.example')).toBeNull();
    expect(currentNext('?next=%2F%2Fevil.example')).toBeNull();
  });

  it('falls back to the Notebook when there is no valid target', () => {
    expect(nextOrDefault('')).toBe('/timeline');
    expect(nextOrDefault('?next=https%3A%2F%2Fevil.example')).toBe('/timeline');
    expect(nextOrDefault('?next=%2Fincident%2Fabc')).toBe('/incident/abc');
  });

  it('carries the target between signed-out screens', () => {
    expect(withNext('/login', '?next=%2Fincident%2Fabc')).toBe('/login?next=%2Fincident%2Fabc');
    expect(withNext('/login', '')).toBe('/login');
  });

  it('builds a safe signed-out redirect from a protected route', () => {
    expect(authRedirectFor('/incident/abc')).toBe('/?next=%2Fincident%2Fabc');
    expect(authRedirectFor('/')).toBe('/');
    expect(authRedirectFor('https://evil.example')).toBe('/');
  });
});

// ------------------------------------------------------------ error boundary

const Boom = ({ secret }: { secret: string }) => {
  throw new Error(`crash containing ${secret}`);
};

describe('error boundary', () => {
  it('catches a throwing child and offers recovery without leaking detail', () => {
    render(
      <AppErrorBoundary>
        <Boom secret="raw-narrative-text" />
      </AppErrorBoundary>,
    );
    expect(screen.getByText(/could not continue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw-narrative-text');
  });

  it('keeps a screen failure contained and offers a route back', () => {
    render(
      <ScreenErrorBoundary>
        <Boom secret="x" />
      </ScreenErrorBoundary>,
    );
    expect(screen.getByRole('link', { name: /back to notebook/i })).toBeInTheDocument();
  });
});

// ------------------------------------------------------------- upload policy

const file = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: 'photo.jpg',
  size: 1024,
  type: 'image/jpeg',
  ...over,
});

describe('upload policy', () => {
  it('accepts an ordinary photo', () => {
    expect(checkUploadAllowed(file())).toBeNull();
  });

  it('rejects files over 20 MB', () => {
    expect(checkUploadAllowed(file({ size: MAX_UPLOAD_BYTES + 1 }))).toMatch(/larger than/i);
  });

  it('rejects empty files', () => {
    expect(checkUploadAllowed(file({ size: 0 }))).toMatch(/empty/i);
  });

  it('enforces the per-record attachment cap', () => {
    expect(checkUploadAllowed(file(), MAX_ATTACHMENTS_PER_RECORD)).toMatch(/maximum/i);
    expect(checkUploadAllowed(file(), MAX_ATTACHMENTS_PER_RECORD - 1)).toBeNull();
  });

  it('rejects active content formats', () => {
    for (const type of ['text/html', 'image/svg+xml', 'application/javascript', 'text/javascript', 'application/x-sh']) {
      expect(checkUploadAllowed(file({ type }))).not.toBeNull();
    }
  });

  it('never lets a filename influence the storage path', () => {
    expect(safeExtension('../../other-user/evil.png')).toBe('png');
    expect(safeExtension('report.png%00.html')).toBe('html');
    expect(safeExtension('noextension')).toBe('bin');
    expect(safeDisplayName('../../etc/passwd')).toBe('passwd');
    expect(safeDisplayName('a\nb.txt')).toBe('a b.txt');
  });

  it('throws through the mutation-level assertion', () => {
    expect(() => assertUploadAllowed(file({ type: 'text/html' }))).toThrow();
    expect(() => assertUploadAllowed(file())).not.toThrow();
  });
});

// ------------------------------------------- local device account isolation

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

const incident = (id: string, owner: string, sync: string) =>
  ({
    id,
    owner_user_id: owner,
    sync_state: sync,
    raw_narrative: `secret narrative ${id}`,
    incident_date: '2026-01-01',
    user_id: owner,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    local_updated_at: '2026-01-01T00:00:00Z',
    last_sync_attempt_at: null,
    last_sync_error: null,
    people_involved: [],
    witnesses: [],
    tags: [],
    status: 'Open',
    locked: false,
    excluded_from_rep: false,
    record_type: 'incident',
    version: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('local account boundary', () => {
  beforeEach(async () => {
    await localDB.incidents.clear();
    await localDB.follow_up_notes.clear();
    await localDB.quarantine.clear();
  });

  it('removes A cached content from the live store when B signs in', async () => {
    await localDB.incidents.bulkPut([
      incident('a-backed', A, 'backed_up'),
      incident('a-local', A, 'local_only'),
    ]);

    const res = await applyAccountBoundary(A, B);
    expect(res.dropped).toBe(1);
    expect(res.quarantined).toBe(1);

    // Nothing belonging to A is readable in the live table any more — not even
    // by an unscoped scan, which is what a curious second user would do.
    const live = await localDB.incidents.toArray();
    expect(live).toHaveLength(0);
    expect(JSON.stringify(live)).not.toContain('secret narrative');
  });

  it('never silently deletes unsynced records and restores them for their owner', async () => {
    await localDB.incidents.bulkPut([
      incident('a-local', A, 'local_only'),
      incident('a-queued', A, 'queued'),
      incident('a-failed', A, 'backup_failed'),
    ]);
    expect(await countUnsyncedFor(A)).toBe(3);

    await applyAccountBoundary(A, B);
    expect(await localDB.quarantine.where('owner_user_id').equals(A).count()).toBe(3);

    // B works, signs out, A returns.
    await applyAccountBoundary(B, A);
    const restored = await localDB.incidents.where('owner_user_id').equals(A).toArray();
    expect(restored).toHaveLength(3);
    expect(await localDB.quarantine.count()).toBe(0);
  });

  it('does not restore another account quarantine', async () => {
    await localDB.incidents.put(incident('a-local', A, 'local_only'));
    await applyAccountBoundary(A, null);
    const restored = await restoreQuarantine(B);
    expect(restored).toBe(0);
    expect(await localDB.incidents.count()).toBe(0);
  });

  it('is a no-op when the same account settles again', async () => {
    await localDB.incidents.put(incident('a-local', A, 'local_only'));
    const res = await applyAccountBoundary(A, A);
    expect(res).toEqual({ dropped: 0, quarantined: 0, restored: 0 });
    expect(await localDB.incidents.count()).toBe(1);
  });
});

// -------------------------------------------------- single upload choke point

describe('upload choke point', () => {
  it('only useEvidence writes to the evidence bucket', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap(name => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });

    const offenders = walk('src')
      .filter(f => /\.(ts|tsx)$/.test(f) && !f.includes('/test/'))
      .filter(f => {
        const src = readFileSync(f, 'utf8').replace(/\s+/g, ' ');
        return /storage\s*\.from\(\s*['"]evidence['"]\s*\)\s*\.upload\(/.test(src);
      })
      .filter(f => !f.endsWith('useEvidence.ts'));

    expect(offenders).toEqual([]);
  });
});
