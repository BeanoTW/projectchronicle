import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDB } from '@/local/db';
import { canonicalLocalRepository } from '@/chronicle/model/canonicalLocalRepository';
import { canonicalRelationshipWriter } from '@/chronicle/model/canonicalRelationshipWriter';

vi.mock('@/chronicle/model/canonicalActivation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/chronicle/model/canonicalActivation')>();
  return { ...actual, getCanonicalActivation: vi.fn(async () => ({ owner_id: 'owner-1' })) };
});

const sealedAt = '2026-08-24T12:00:00.000Z';

describe('Phase 10 — canonical relationships', () => {
  beforeEach(async () => {
    await localDB.delete();
    await localDB.open();
    await canonicalLocalRepository.seal({
      id: 'record-1', owner_id: 'owner-1', kind: 'incident',
      original: { text: 'Original wording.', source: 'written', media_ids: [], sealed_at: sealedAt },
      captured_at: sealedAt, sealed_at: sealedAt,
    });
  });

  afterEach(async () => {
    localDB.close();
    await localDB.delete();
  });

  it('adds a relationship and audit history atomically without touching original wording', async () => {
    const relation = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1', 'Manager');
    expect(relation.role_note).toBe('Manager');
    expect(await localDB.canonical_relationships.count()).toBe(1);
    expect(await localDB.canonical_history.count()).toBe(1);
    expect((await canonicalLocalRepository.get('owner-1', 'record-1'))?.original.text).toBe('Original wording.');
  });

  it('is idempotent for an already-active entity relationship', async () => {
    const first = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1');
    const second = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1');
    expect(second.id).toBe(first.id);
    expect(await localDB.canonical_relationships.count()).toBe(1);
    expect(await localDB.canonical_history.count()).toBe(1);
  });

  it('soft-removes a relationship and retains its historical row', async () => {
    const relation = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1');
    await canonicalRelationshipWriter.remove('owner-1', 'record-1', relation.id);
    const stored = await localDB.canonical_relationships.get(relation.id);
    expect(stored?.removed_at).toBeTruthy();
    expect(await localDB.canonical_relationships.count()).toBe(1);
    expect(await localDB.canonical_history.count()).toBe(2);
  });
});
