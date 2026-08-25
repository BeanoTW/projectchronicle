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
const laterHistoryCount = async () => (await localDB.canonical_history.toArray()).filter(row => row.action !== 'sealed').length;

describe('Phase 10/11 — canonical relationships', () => {
  beforeEach(async () => {
    await localDB.delete(); await localDB.open();
    await canonicalLocalRepository.seal({ id: 'record-1', owner_id: 'owner-1', kind: 'incident', original: { text: 'Original wording.', source: 'written', media_ids: [], sealed_at: sealedAt }, captured_at: sealedAt, sealed_at: sealedAt });
  });
  afterEach(async () => { localDB.close(); await localDB.delete(); });

  it('adds a person relationship, audit history and person index without touching original wording', async () => {
    const relation = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1', 'Manager');
    const record = await canonicalLocalRepository.get('owner-1', 'record-1');
    expect(relation.role_note).toBe('Manager');
    expect(await localDB.canonical_relationships.count()).toBe(1);
    expect(await laterHistoryCount()).toBe(1);
    expect(record?.details.person_ids).toEqual(['person-1']);
    expect(record?.details.revision_count).toBe(1);
    expect(record?.original.text).toBe('Original wording.');
  });

  it('is idempotent for an already-active entity relationship', async () => {
    const first = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1');
    const second = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1');
    expect(second.id).toBe(first.id);
    expect(await localDB.canonical_relationships.count()).toBe(1);
    expect(await laterHistoryCount()).toBe(1);
    expect((await canonicalLocalRepository.get('owner-1', 'record-1'))?.details.revision_count).toBe(1);
  });

  it('soft-removes a person relationship and removes the active person index while retaining history', async () => {
    const relation = await canonicalRelationshipWriter.add('owner-1', 'record-1', 'person', 'person-1');
    await canonicalRelationshipWriter.remove('owner-1', 'record-1', relation.id);
    const stored = await localDB.canonical_relationships.get(relation.id);
    const record = await canonicalLocalRepository.get('owner-1', 'record-1');
    expect(stored?.removed_at).toBeTruthy();
    expect(await localDB.canonical_relationships.count()).toBe(1);
    expect(await laterHistoryCount()).toBe(2);
    expect(record?.details.person_ids).toEqual([]);
    expect(record?.details.revision_count).toBe(2);
    expect(record?.original.text).toBe('Original wording.');
  });

  it('does not put organisation relationships into the person index', async () => {
    await canonicalRelationshipWriter.add('owner-1', 'record-1', 'organisation', 'org-1');
    expect((await canonicalLocalRepository.get('owner-1', 'record-1'))?.details.person_ids).toEqual([]);
  });
});
