import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDB } from '@/local/db';
import { canonicalOrganisationWriter } from '@/chronicle/model/canonicalOrganisationWriter';

vi.mock('@/chronicle/model/canonicalActivation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/chronicle/model/canonicalActivation')>();
  return { ...actual, getCanonicalActivation: vi.fn(async () => ({ owner_id: 'owner-1' })) };
});

describe('Phase 11 — canonical organisation registry', () => {
  beforeEach(async () => { await localDB.delete(); await localDB.open(); });
  afterEach(async () => { localDB.close(); await localDB.delete(); });

  it('normalises names and reuses an existing active organisation identity', async () => {
    const first = await canonicalOrganisationWriter.ensure('owner-1', '  Example   Ltd ', 'Employer');
    const second = await canonicalOrganisationWriter.ensure('owner-1', 'example ltd');
    expect(second.id).toBe(first.id);
    expect(first.display_name).toBe('Example Ltd');
    expect(first.normalised_name).toBe('example ltd');
    expect(await localDB.canonical_organisations.count()).toBe(1);
  });

  it('keeps organisation identities owner scoped', async () => {
    const first = await canonicalOrganisationWriter.ensure('owner-1', 'Example Ltd');
    const second = await canonicalOrganisationWriter.ensure('owner-2', 'Example Ltd');
    expect(second.id).not.toBe(first.id);
    expect(await localDB.canonical_organisations.count()).toBe(2);
  });
});
