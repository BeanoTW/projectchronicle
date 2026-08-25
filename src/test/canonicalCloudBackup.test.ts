import { describe, expect, it } from 'vitest';
import { V2RecordSchema } from '@/chronicle/model/contracts';
import type { V2Record } from '@/chronicle/model/schema';
import { canonicalMediaPath } from '@/chronicle/sync/canonicalBackup';
import { markCanonicalConflict, markCanonicalFailed, markCanonicalQueued, markCanonicalSynced } from '@/chronicle/sync/canonicalCloud';

const record = (): V2Record => V2RecordSchema.parse({
  id: 'record-1', owner_id: 'owner-1', kind: 'incident', schema_version: 2,
  original: { text: 'Exact wording', source: 'written', media_ids: [], sealed_at: '2026-08-25T12:00:00.000Z' },
  details: { title: null, category_id: null, context: null, person_ids: [], location: null, event_date: null, event_time: null, revision_count: 0 },
  lifecycle: { state: 'sealed' }, dossier: { state: 'not_included' },
  captured_at: '2026-08-25T11:59:00.000Z', sealed_at: '2026-08-25T12:00:00.000Z', created_at: '2026-08-25T12:00:00.000Z', updated_at: '2026-08-25T12:00:00.000Z',
  sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
});

const at = '2026-08-25T13:00:00.000Z';

describe('canonical cloud transport contracts', () => {
  it('uses only canonical sync-state variants while attempting and failing', () => {
    const queued = markCanonicalQueued(record(), at);
    expect(queued.sync.state).toEqual({ state: 'queued', since: at });
    const failed = markCanonicalFailed(queued, at, 'offline');
    expect(failed.sync.state).toEqual({ state: 'failed', at, attempts: 1, message: 'offline' });
    expect(() => V2RecordSchema.parse(failed)).not.toThrow();
  });

  it('keeps successful remote revision fields internally consistent', () => {
    const synced = markCanonicalSynced(record(), at, 4);
    expect(synced.sync.remote_version).toBe(4);
    expect(synced.sync.state).toEqual({ state: 'synced', at, remote_version: 4 });
    expect(() => V2RecordSchema.parse(synced)).not.toThrow();
  });

  it('records a real numeric remote conflict without overwriting local content', () => {
    const original = record();
    const conflicted = markCanonicalConflict(original, at, 7);
    expect(conflicted.original).toEqual(original.original);
    expect(conflicted.sync.state).toEqual({ state: 'conflict', detected_at: at, remote_version: 7 });
  });

  it('uses owner/record/media object paths for private canonical storage', () => {
    expect(canonicalMediaPath('owner-a', 'record-b', 'media-c')).toBe('owner-a/record-b/media-c');
  });
});
