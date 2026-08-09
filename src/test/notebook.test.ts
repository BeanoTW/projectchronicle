import { describe, it, expect, beforeEach } from 'vitest';
import { toNotebookRecords } from '@/v2/shared/productionNotebookAdapter';
import {
  recordMatchesFilters,
  recordMatchesSearch,
  monthCounts,
  sortByRecency,
  uniqueCategories,
  uniquePeople,
} from '@/v2/shared/notebookModel';
import { cloneFilters, emptyFilters } from '@/v2/filters';
import {
  FLAG_DEFAULTS,
  isFeatureEnabled,
  setFeatureOverride,
  clearFeatureOverrides,
  setAllV2Override,
} from '@/lib/featureFlags';
import type { LocalIncident } from '@/local/db';

const inc = (over: Partial<LocalIncident>): LocalIncident => ({
  id: 'i1',
  user_id: 'u1',
  owner_user_id: 'u1',
  incident_date: '2026-03-04',
  incident_time: null,
  location: null,
  people_involved: [],
  witnesses: [],
  category: null,
  subtype: null,
  severity: null,
  impact_note: null,
  raw_narrative: 'Something happened',
  ai_summary: null,
  exact_words: null,
  tags: [],
  status: 'Open',
  locked: false,
  excluded_from_rep: false,
  record_method: 'text',
  title: null,
  created_at: '2026-03-04T10:00:00.000Z',
  updated_at: '2026-03-04T10:00:00.000Z',
  original_created_at: '2026-03-04T10:00:00.000Z',
  ...(over as object),
} as LocalIncident);

const build = (incidents: LocalIncident[], notes: Array<{ incident_id: string }> = [], evidence?: never[]) =>
  toNotebookRecords({ incidents, notes, evidence });

describe('production notebook adapter', () => {
  it('normalises canonical fields', () => {
    const [r] = build([inc({
      title: 'Meeting',
      category: 'Communication',
      people_involved: ['Alex'],
      excluded_from_rep: false,
      record_method: 'voice',
    })]);
    expect(r.title).toBe('Meeting');
    expect(r.dateKey).toBe('2026-03-04');
    expect(r.category).toBe('Communication');
    expect(r.people).toEqual(['Alex']);
    expect(r.inDossier).toBe(true);
    expect(r.hasVoice).toBe(true);
    expect(r.chips).toContain('Incident');
  });

  it('falls back to the first line of the original wording for a title', () => {
    const [r] = build([inc({ raw_narrative: 'First line\nsecond line' })]);
    expect(r.title).toBe('First line');
    expect(r.preview).toBe('First line\nsecond line');
  });

  it('maps excluded_from_rep to dossier status', () => {
    const [r] = build([inc({ excluded_from_rep: true })]);
    expect(r.inDossier).toBe(false);
  });

  it('derives clarification presence from follow-up notes', () => {
    const [a, b] = build([inc({ id: 'a' }), inc({ id: 'b' })], [{ incident_id: 'a' }]);
    expect(a.hasClarifications).toBe(true);
    expect(a.clarificationCount).toBe(1);
    expect(b.hasClarifications).toBe(false);
  });

  it('uses record_date for daily records', () => {
    const [r] = build([inc({ record_type: 'daily_record', record_date: '2026-02-01' } as Partial<LocalIncident>)]);
    expect(r.dateKey).toBe('2026-02-01');
    expect(r.chips).toContain('Daily record');
  });

  it('counts attachments per record', () => {
    const rows = toNotebookRecords({
      incidents: [inc({ id: 'a' })],
      notes: [],
      evidence: [
        { incident_id: 'a', mime_type: 'image/png' },
        { incident_id: 'a', mime_type: 'application/pdf' },
        { incident_id: null, mime_type: 'image/png' },
      ] as never,
    });
    expect(rows[0].attachmentCount).toBe(2);
    expect(rows[0].attachmentTypes.sort()).toEqual(['document', 'image']);
  });
});

describe('notebook filtering', () => {
  const records = build([
    inc({ id: 'a', category: 'Communication', people_involved: ['Alex'], incident_date: '2026-01-10', raw_narrative: 'shouting in the corridor', created_at: '2026-01-10T09:00:00.000Z', original_created_at: '2026-01-10T09:00:00.000Z' }),
    inc({ id: 'b', category: 'Pay / Benefits', people_involved: ['Sam'], incident_date: '2026-02-15', excluded_from_rep: true, record_method: 'voice', created_at: '2026-02-15T09:00:00.000Z', original_created_at: '2026-02-15T09:00:00.000Z' }),
  ], [{ incident_id: 'a' }]);

  const f = (over: Partial<typeof emptyFilters>) => ({ ...cloneFilters(emptyFilters), ...over });
  const ids = (rows: typeof records) => rows.map(r => r.id);

  it('searches original wording and people', () => {
    expect(ids(records.filter(r => recordMatchesSearch(r, 'shouting')))).toEqual(['a']);
    expect(ids(records.filter(r => recordMatchesSearch(r, 'sam')))).toEqual(['b']);
    expect(ids(records.filter(r => recordMatchesSearch(r, '')))).toEqual(['a', 'b']);
  });

  it('filters by category, people, date range, dossier, clarifications and voice', () => {
    expect(ids(records.filter(r => recordMatchesFilters(r, f({ categories: ['Communication'] }))))).toEqual(['a']);
    expect(ids(records.filter(r => recordMatchesFilters(r, f({ people: ['Sam'] }))))).toEqual(['b']);
    expect(ids(records.filter(r => recordMatchesFilters(r, f({ from: '2026-02-01' }))))).toEqual(['b']);
    expect(ids(records.filter(r => recordMatchesFilters(r, f({ to: '2026-01-31' }))))).toEqual(['a']);
    expect(ids(records.filter(r => recordMatchesFilters(r, f({ dossier: 'excluded' }))))).toEqual(['b']);
    expect(ids(records.filter(r => recordMatchesFilters(r, f({ withClarifications: true }))))).toEqual(['a']);
    expect(ids(records.filter(r => recordMatchesFilters(r, f({ hasVoice: true }))))).toEqual(['b']);
  });

  it('sorts reverse chronologically and exposes real facet values', () => {
    expect(ids(sortByRecency(records))).toEqual(['b', 'a']);
    expect(uniqueCategories(records)).toEqual(['Communication', 'Pay / Benefits']);
    expect(uniquePeople(records)).toEqual(['Alex', 'Sam']);
  });

  it('counts records per day in a month', () => {
    const counts = monthCounts(records, '2026-01');
    expect(counts.get('2026-01-10')).toBe(1);
    expect(counts.get('2026-02-15')).toBeUndefined();
  });
});

describe('v2Notebook feature flag', () => {
  // Phase 8: tester hosts default to V2, so tests pin an explicit V1 baseline.
  beforeEach(() => { clearFeatureOverrides(); setAllV2Override(false); });

  it('defaults off so V1 Timeline is served', () => {
    expect(FLAG_DEFAULTS.v2Notebook).toBe(false);   // V1 remains the public default
    expect(isFeatureEnabled('v2Notebook')).toBe(false);
  });

  it('is independent of v2Entry', () => {
    setFeatureOverride('v2Notebook', true);
    expect(isFeatureEnabled('v2Notebook')).toBe(true);
    expect(isFeatureEnabled('v2Entry')).toBe(false);
    setFeatureOverride('v2Entry', true);
    setFeatureOverride('v2Notebook', false);
    expect(isFeatureEnabled('v2Entry')).toBe(true);
    expect(isFeatureEnabled('v2Notebook')).toBe(false);
  });

  it('rolls back with one configuration change', () => {
    setFeatureOverride('v2Notebook', true);
    setFeatureOverride('v2Notebook', null);
    expect(isFeatureEnabled('v2Notebook')).toBe(false);
  });
});
