import { describe, expect, it } from 'vitest';
import type { OrganisationalDetails } from '@/chronicle/model/schema';

const base: OrganisationalDetails = {
  title: null, category_id: null, context: null, person_ids: [], location: null,
  event_date: { kind: 'range', start: '2026-08-01', end: '2026-08-03' }, event_time: null, revision_count: 2,
};

describe('CanonicalDetailsEditor contract', () => {
  it('keeps person identities outside the general details editing surface', () => {
    expect(base.person_ids).toEqual([]);
    expect(base.event_date).toEqual({ kind: 'range', start: '2026-08-01', end: '2026-08-03' });
  });
});
