import { describe, expect, it } from 'vitest';
import { canonicalHistoryToItems, provenanceLabel } from '@/chronicle/shared/canonicalEntryAdapter';
import type { CanonicalEntryBundle } from '@/chronicle/model/canonicalEntryReader';

const event = (id: string, action: CanonicalEntryBundle['history'][number]['action'], field: string | null = null, toValue: string | null = null) => ({
  id, record_id: 'record-1', owner_id: 'owner-1', at: '2026-08-25T08:00:00.000Z',
  action, field, from_value: null, to_value: toValue, actor: 'user' as const,
});

describe('Phase 3/4 — plain Record History and provenance projection', () => {
  it('keeps the initial seal separate and describes later record actions plainly', () => {
    const bundle = { history: [
      event('sealed', 'sealed'),
      event('details', 'details_updated', 'category_id'),
      event('clarification', 'clarification_added'),
      event('membership', 'dossier_included'),
    ] } as unknown as CanonicalEntryBundle;

    expect(canonicalHistoryToItems(bundle)).toEqual([
      { id: 'details', label: 'Details updated', at: '2026-08-25T08:00:00.000Z', note: 'Category changed' },
      { id: 'clarification', label: 'Clarification added', at: '2026-08-25T08:00:00.000Z', note: null },
      { id: 'membership', label: 'Added to Chronicle', at: '2026-08-25T08:00:00.000Z', note: null },
    ]);
  });

  it('describes accepted structure assistance neutrally with frozen metadata', () => {
    const bundle = { history: [
      event('helper', 'input_helper_accepted', 'structure_assistance', JSON.stringify({ acceptedSuggestionCount: 2, helperVersion: 'structure-helper/1.0' })),
    ] } as unknown as CanonicalEntryBundle;
    expect(canonicalHistoryToItems(bundle)).toEqual([
      {
        id: 'helper',
        label: 'Structure assistance accepted before sealing',
        at: '2026-08-25T08:00:00.000Z',
        note: '2 suggestions accepted · Helper structure-helper/1.0',
      },
    ]);
  });

  it('renders missing legacy provenance as not recorded rather than helper unused', () => {
    expect(provenanceLabel(undefined)).toBe('Provenance not recorded');
    expect(provenanceLabel({ schema_version: 1, tracking_state: 'NOT_RECORDED' })).toBe('Provenance not recorded');
  });
});
