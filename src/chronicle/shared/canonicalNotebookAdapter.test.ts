import { describe, expect, it } from 'vitest';
import { canonicalRecordsToNotebookRecords } from './canonicalNotebookAdapter';
import type { V2Record } from '@/chronicle/model/schema';

const record = (patch: Partial<V2Record> = {}): V2Record => ({
  id: 'r1', owner_id: 'u1', kind: 'incident', schema_version: 2,
  original: { text: 'Exact original wording', source: 'written', media_ids: [], sealed_at: '2026-08-01T10:00:00Z' },
  details: { title: 'Title', category_id: 'work', context: 'workplace', person_ids: ['p1'], location: 'Office', event_date: { kind: 'exact', date: '2026-07-31' }, event_time: '09:00', revision_count: 0 },
  lifecycle: { state: 'sealed' }, dossier: { state: 'included', included_at: '2026-08-01T10:00:00Z' },
  captured_at: '2026-08-01T09:55:00Z', sealed_at: '2026-08-01T10:00:00Z', created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z',
  sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
  ...patch,
});

describe('canonicalRecordsToNotebookRecords', () => {
  it('preserves original wording and canonical organisational details', () => {
    const [row] = canonicalRecordsToNotebookRecords([record()], new Map([['p1', 'Alex']]));
    expect(row.preview).toBe('Exact original wording');
    expect(row.dateKey).toBe('2026-07-31');
    expect(row.people).toEqual(['Alex']);
    expect(row.inDossier).toBe(true);
    expect(row.searchExtras).toContain('Office');
  });

  it('does not surface user-deleted canonical records', () => {
    const rows = canonicalRecordsToNotebookRecords([record({ lifecycle: { state: 'deleted_by_user', deleted_at: '2026-08-02T00:00:00Z' } })]);
    expect(rows).toEqual([]);
  });

  it('uses the start of a user-supplied range without inventing precision', () => {
    const value = record();
    value.details.event_date = { kind: 'range', start: '2026-07-01', end: '2026-07-03' };
    expect(canonicalRecordsToNotebookRecords([value])[0].dateKey).toBe('2026-07-01');
  });

  it('recognises voice sources without reading legacy record_method', () => {
    const base = record();
    const value = { ...base, original: { ...base.original, source: 'voice' as const } };
    expect(canonicalRecordsToNotebookRecords([value])[0].hasVoice).toBe(true);
  });
});
