// Phase 7 — release-level coverage for the default-on decision.
//
// Focus: the things that must hold before every V2 flag flips on.
//   1. Full V2 mode + flag independence
//   2. Record-type parity (daily records are not lost)
//   3. Privacy Shield is display-only (never changes stored data or exports)
//   4. Record history is plain language and value-free
//   5. Source isolation — no production screen imports the preview database
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FLAG_DEFAULTS,
  environmentDefault,
  isTesterEnvironment,
  clearFeatureOverrides,
  isFeatureEnabled,
  isFullV2Enabled,
  setAllV2Override,
  setFeatureOverride,
} from '@/lib/featureFlags';
import { emptyFilters, cloneFilters, activeFilterCount, type NotebookFilters } from '@/v2/filters';
import { recordMatchesFilters, type NotebookRecord } from '@/v2/shared/notebookModel';
import { toHistoryItems, wordingWasChanged } from '@/v2/shared/recordHistoryModel';

const FLAGS = ['v2Entry', 'v2Notebook', 'v2Capture', 'v2Dossier'] as const;

const record = (over: Partial<NotebookRecord> = {}): NotebookRecord => ({
  id: 'r1',
  title: null,
  preview: 'Something happened.',
  dateKey: '2026-02-01',
  recordedAt: '2026-02-01T10:00:00.000Z',
  category: null,
  recordType: 'incident',
  searchExtras: [],
  people: [],
  inDossier: true,
  hasClarifications: false,
  clarificationCount: 0,
  hasVoice: false,
  attachmentCount: 0,
  attachmentTypes: [],
  chips: [],
  ...over,
});

describe('full V2 mode', () => {
  beforeEach(() => clearFeatureOverrides());

  it('follows the environment default when nothing is overridden', () => {
    FLAGS.forEach(f => expect(isFeatureEnabled(f)).toBe(environmentDefault(f)));
  });

  it('is default-on for tester hosts and default-off for public production hosts', () => {
    expect(isTesterEnvironment('localhost')).toBe(true);
    expect(isTesterEnvironment('projectchronicle.lovable.app')).toBe(true);
    expect(isTesterEnvironment('projectchronicle.app')).toBe(false);
    expect(isTesterEnvironment('www.projectchronicle.app')).toBe(false);
    FLAGS.forEach(f => expect(FLAG_DEFAULTS[f]).toBe(false));   // V1 remains the public default
  });

  it('can return the whole application to V1', () => {
    setAllV2Override(false);
    FLAGS.forEach(f => expect(isFeatureEnabled(f)).toBe(false));
    expect(isFullV2Enabled()).toBe(false);
  });

  it('turns every migrated route on at once', () => {
    setAllV2Override(true);
    FLAGS.forEach(f => expect(isFeatureEnabled(f)).toBe(true));
    expect(isFullV2Enabled()).toBe(true);
  });

  it('keeps individual flags independent — a single route can still be rolled back', () => {
    setAllV2Override(true);
    setFeatureOverride('v2Dossier', false);
    expect(isFeatureEnabled('v2Dossier')).toBe(false);
    expect(isFeatureEnabled('v2Capture')).toBe(true);
    expect(isFullV2Enabled()).toBe(false);
  });

  it('a single flag works without the meta switch', () => {
    setAllV2Override(false);
    setFeatureOverride('v2Notebook', true);
    expect(isFeatureEnabled('v2Notebook')).toBe(true);
    expect(isFeatureEnabled('v2Entry')).toBe(false);
  });

  it('clearing overrides returns every route to its default', () => {
    setAllV2Override(true);
    clearFeatureOverrides();
    FLAGS.forEach(f => expect(isFeatureEnabled(f)).toBe(environmentDefault(f)));
  });
});

describe('record-type parity', () => {
  const filters = (over: Partial<NotebookFilters>): NotebookFilters => ({ ...cloneFilters(emptyFilters), ...over });

  it('shows both record types when no type filter is set', () => {
    const f = cloneFilters(emptyFilters);
    expect(recordMatchesFilters(record({ recordType: 'daily' }), f)).toBe(true);
    expect(recordMatchesFilters(record({ recordType: 'incident' }), f)).toBe(true);
  });

  it('filters to daily records only', () => {
    const f = filters({ recordTypes: ['daily'] });
    expect(recordMatchesFilters(record({ recordType: 'daily' }), f)).toBe(true);
    expect(recordMatchesFilters(record({ recordType: 'incident' }), f)).toBe(false);
  });

  it('counts the record-type filter as active', () => {
    expect(activeFilterCount(filters({ recordTypes: ['incident'] }))).toBe(1);
    expect(activeFilterCount(cloneFilters(emptyFilters))).toBe(0);
  });
});

describe('record history', () => {
  const row = (over: Partial<Parameters<typeof toHistoryItems>[0][number]> = {}) => ({
    id: 'h1',
    field_changed: 'category',
    old_value: null,
    new_value: 'Bullying',
    changed_at: '2026-02-02T09:00:00.000Z',
    edit_source: 'user',
    ...over,
  });

  it('states plainly when the original wording is untouched', () => {
    expect(wordingWasChanged([row()])).toBe(false);
    expect(wordingWasChanged([row({ field_changed: 'raw_narrative' })])).toBe(true);
  });

  it('never exposes the changed values themselves', () => {
    const [item] = toHistoryItems([row()]);
    expect(item.label).toBe('Category added');
    expect(JSON.stringify(item)).not.toContain('Bullying');
  });

  it('describes removals and changes in plain language', () => {
    expect(toHistoryItems([row({ old_value: 'A', new_value: null })])[0].label).toBe('Category removed');
    expect(toHistoryItems([row({ old_value: 'A', new_value: 'B' })])[0].label).toBe('Category changed');
  });

  it('notes a transcription source without technical wording', () => {
    const [item] = toHistoryItems([row({ edit_source: 'transcription' })]);
    expect(item.note).toBe('added from a voice record');
  });

  it('orders oldest first', () => {
    const items = toHistoryItems([
      row({ id: 'b', changed_at: '2026-03-01T00:00:00.000Z' }),
      row({ id: 'a', changed_at: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(items.map(i => i.id)).toEqual(['a', 'b']);
  });
});

describe('source isolation for production V2 screens', () => {
  const read = (p: string) => readFileSync(p, 'utf8');

  it('production screens never import the preview database', () => {
    ['src/pages/NotebookScreenV2.tsx', 'src/pages/EntryScreenV2.tsx',
     'src/pages/CaptureScreenV2.tsx', 'src/pages/DossierScreenV2.tsx']
      .forEach(f => {
        const src = read(f);
        expect(src).not.toContain("from '@/v2/db'");
        expect(src).not.toContain('chronicle_prototype');
      });
  });

  it('shared views stay storage-agnostic', () => {
    ['src/v2/shared/NotebookView.tsx', 'src/v2/shared/EntryView.tsx',
     'src/v2/shared/CaptureView.tsx', 'src/v2/shared/DossierView.tsx',
     'src/v2/shared/RecordHistoryView.tsx']
      .forEach(f => {
        const src = read(f);
        expect(src).not.toContain('@/integrations/supabase');
        expect(src).not.toContain("from '../db'");
        expect(src).not.toContain("from '@/v2/db'");
      });
  });

  it('Privacy Shield masking is applied in screens, not in the export pipeline', () => {
    ['src/v2/dossier/document.ts', 'src/v2/dossier/exportPdf.ts', 'src/v2/dossier/exportDocx.ts']
      .forEach(f => expect(read(f)).not.toContain('PrivacyContext'));
  });
});
