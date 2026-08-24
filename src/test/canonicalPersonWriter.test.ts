import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDB } from '@/local/db';
import { canonicalPersonWriter } from '@/chronicle/model/canonicalPersonWriter';

vi.mock('@/chronicle/model/canonicalActivation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/chronicle/model/canonicalActivation')>();
  return { ...actual, getCanonicalActivation: vi.fn(async () => ({ owner_id: 'owner-1' })) };
});

describe('Phase 11 — canonical person registry', () => {
  beforeEach(async () => { await localDB.delete(); await localDB.open(); });
  afterEach(async () => { localDB.close(); await localDB.delete(); });

  it('normalises whitespace and reuses an existing active identity', async () => {
    const first = await canonicalPersonWriter.ensure('owner-1', '  Alex   Smith  ', 'Manager');
    const second = await canonicalPersonWriter.ensure('owner-1', 'alex smith');
    expect(second.id).toBe(first.id);
    expect(first.display_name).toBe('Alex Smith');
    expect(first.normalised_name).toBe('alex smith');
    expect(await localDB.canonical_people.count()).toBe(1);
  });

  it('keeps different owners isolated even for the same name', async () => {
    const first = await canonicalPersonWriter.ensure('owner-1', 'Alex Smith');
    const second = await canonicalPersonWriter.ensure('owner-2', 'Alex Smith');
    expect(second.id).not.toBe(first.id);
    expect(await localDB.canonical_people.count()).toBe(2);
  });
});
