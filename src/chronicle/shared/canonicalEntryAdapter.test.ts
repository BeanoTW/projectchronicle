import { describe, expect, it } from 'vitest';
import { canonicalEntryToSharedView, canonicalHistoryToItems } from './canonicalEntryAdapter';
import type { CanonicalEntryBundle } from '@/chronicle/model/canonicalEntryReader';

const bundle = (): CanonicalEntryBundle => ({
  source: 'canonical',
  record: {
    id: 'r1', owner_id: 'u1', kind: 'incident', schema_version: 2,
    original: { text: 'Never rewrite me', source: 'imported_v1', media_ids: [], sealed_at: '2026-08-01T10:00:00Z' },
    details: { title: 'Title', category_id: 'work', context: 'workplace', person_ids: ['p1'], location: 'Office', event_date: { kind: 'approximate', date: '2026-07-31', daypart: 'morning' }, event_time: null, revision_count: 0 },
    lifecycle: { state: 'sealed' }, dossier: { state: 'included', included_at: '2026-08-01T10:00:00Z' },
    captured_at: '2026-08-01T09:50:00Z', sealed_at: '2026-08-01T10:00:00Z', created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z',
    sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
  },
  people: [{ id: 'p1', owner_id: 'u1', display_name: 'Alex', normalised_name: 'alex', role_note: null, created_at: '2026-08-01T10:00:00Z', merged_into_id: null }],
  organisations: [{ id: 'o1', owner_id: 'u1', display_name: 'Example Ltd', normalised_name: 'example ltd', note: null, created_at: '2026-08-01T10:00:00Z', merged_into_id: null }],
  relationships: [],
  clarifications: [{ id: 'c1', record_id: 'r1', owner_id: 'u1', kind: 'clarification', text: 'Later context', created_at: '2026-08-02T10:00:00Z', sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null } }],
  media: [],
  history: [{ id: 'h1', record_id: 'r1', owner_id: 'u1', at: '2026-08-03T10:00:00Z', action: 'details_updated', field: 'location', from_value: 'A', to_value: 'B', actor: 'user' }],
});

describe('canonical entry adapter', () => {
  it('keeps immutable wording and renders honest approximate date precision and linked entities', () => {
    const view = canonicalEntryToSharedView(bundle());
    expect(view.original_text).toBe('Never rewrite me');
    expect(view.details).toContainEqual(['Event date', 'Approx. 2026-07-31 · morning']);
    expect(view.details).toContainEqual(['People', 'Alex']);
    expect(view.details).toContainEqual(['Organisations', 'Example Ltd']);
    expect(view.clarifications[0].text).toBe('Later context');
  });

  it('maps canonical history without exposing raw values', () => {
    const items = canonicalHistoryToItems(bundle());
    expect(items).toEqual([{ id: 'h1', label: 'Details updated', at: '2026-08-03T10:00:00Z', note: 'Location changed' }]);
  });
});
