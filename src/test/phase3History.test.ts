import { describe, expect, it } from 'vitest';
import { canonicalHistoryToItems } from '@/chronicle/shared/canonicalEntryAdapter';
import type { CanonicalEntryBundle } from '@/chronicle/model/canonicalEntryReader';

const event = (id: string, action: CanonicalEntryBundle['history'][number]['action'], field: string | null = null) => ({
  id, record_id: 'record-1', owner_id: 'owner-1', at: '2026-08-25T08:00:00.000Z',
  action, field, from_value: null, to_value: null, actor: 'user' as const,
});

describe('Phase 3 — plain Record History projection', () => {
  it('keeps the initial seal separate and describes later record actions plainly', () => {
    const bundle = { history: [
      event('sealed', 'sealed'),
      event('details', 'details_updated', 'category_id'),
      event('clarification', 'clarification_added'),
      event('membership', 'dossier_included'),
    ] } as CanonicalEntryBundle;

    expect(canonicalHistoryToItems(bundle)).toEqual([
      { id: 'details', label: 'Details updated', at: '2026-08-25T08:00:00.000Z', note: 'Category changed' },
      { id: 'clarification', label: 'Clarification added', at: '2026-08-25T08:00:00.000Z', note: null },
      { id: 'membership', label: 'Added to Chronicle', at: '2026-08-25T08:00:00.000Z', note: null },
    ]);
  });
});
