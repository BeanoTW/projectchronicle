import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDB } from '@/local/db';
import { canonicalLocalRepository } from '@/chronicle/model/canonicalLocalRepository';
import { canonicalEvidenceWriter } from '@/chronicle/model/canonicalEvidenceWriter';

vi.mock('@/chronicle/model/canonicalActivation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/chronicle/model/canonicalActivation')>();
  return { ...actual, getCanonicalActivation: vi.fn(async () => ({ owner_id: 'owner-1' })) };
});

const at = '2026-08-24T12:00:00.000Z';
const sync = { remote_version: null, local_revision: 0, state: { state: 'local_only' as const }, last_attempt_at: null };

describe('Phase 10 — canonical evidence metadata', () => {
  beforeEach(async () => {
    await localDB.delete(); await localDB.open();
    await canonicalLocalRepository.seal({ id: 'record-1', owner_id: 'owner-1', kind: 'incident', original: { text: 'Original.', source: 'written', media_ids: [], sealed_at: at }, captured_at: at, sealed_at: at });
    await canonicalLocalRepository.appendMedia({ id: 'media-1', record_id: 'record-1', owner_id: 'owner-1', kind: 'image', role: 'later', name: 'photo.jpg', mime: 'image/jpeg', size: 42, duration_ms: null, description: null, added_at: at, inclusion: { state: 'included' }, storage: { location: 'local', ok: true }, content_hash: 'hash', sync });
  });
  afterEach(async () => { localDB.close(); await localDB.delete(); });

  it('changes dossier inclusion while preserving immutable evidence identity and hash', async () => {
    await canonicalEvidenceWriter.setDossierInclusion('owner-1', 'record-1', 'media-1', false, 'Not relevant');
    const media = await localDB.canonical_media.get('media-1');
    expect(media?.inclusion.state).toBe('excluded_from_dossier');
    expect(media?.name).toBe('photo.jpg');
    expect(media?.content_hash).toBe('hash');
    expect(await localDB.canonical_history.count()).toBe(1);
  });

  it('allows description metadata to change without rewriting bytes metadata', async () => {
    await canonicalEvidenceWriter.describe('owner-1', 'record-1', 'media-1', ' Doorway photo ');
    const media = await localDB.canonical_media.get('media-1');
    expect(media?.description).toBe('Doorway photo');
    expect(media?.size).toBe(42);
    expect(media?.content_hash).toBe('hash');
    expect(await localDB.canonical_history.count()).toBe(1);
  });
});
