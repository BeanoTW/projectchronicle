import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrivacyProvider, usePrivacy } from '@/contexts/PrivacyContext';
import { planMigration, KNOWN_UNMAPPED_FIELDS } from '@/chronicle/model/migrationPlan';
import { buildDossierFromSource, defaultDossierConfig, type DossierSourceMedia } from '@/chronicle/shared/dossierModel';
import { ORIGINAL_EVIDENCE_WINDOW_MS, toDossierSourceMedia } from '@/chronicle/shared/productionDossierAdapter';
import { toHistoryItems, wordingWasChanged } from '@/chronicle/shared/recordHistoryModel';
import {
  canonicalRecord,
  evidenceAtCurrentBoundaries,
  legacySnapshot,
  productionIncident,
  wordingHistory,
} from '@/chronicle/model/fixtures/legacyArchaeologyFixtures';

vi.mock('@/lib/analytics/analytics', () => ({ analytics: { track: vi.fn() } }));

describe('Phase 0 architecture safety baseline', () => {
  it('keeps complete and incomplete wording history honest', () => {
    expect(wordingWasChanged(wordingHistory)).toBe(true);
    expect(wordingHistory[0]).toMatchObject({ old_value: 'Earlier wording', new_value: 'Later wording' });
    expect(wordingHistory[1]).toMatchObject({ old_value: null, new_value: null });
    expect(toHistoryItems(wordingHistory).map(item => item.label)).toEqual([
      'Written wording changed',
      'Written wording changed',
    ]);
  });

  it('plans legacy migration deterministically and accounts for every child row', () => {
    const options = { now: '2026-08-23T00:00:00.000Z' };
    const first = planMigration(legacySnapshot, options);
    const second = planMigration(legacySnapshot, options);

    expect(second).toEqual(first);
    expect(first.report.counts.records_inspected).toBe(legacySnapshot.incidents.length);
    expect(first.report.counts.clarifications_created + first.report.warnings.filter(w => w.code === 'orphan_follow_up_note').length)
      .toBe(legacySnapshot.notes.length);
    expect(first.report.counts.media_linked + first.report.warnings.filter(w => w.code === 'orphan_attachment').length)
      .toBe(legacySnapshot.evidence.length);
    expect(first.report.counts.history_events_created + first.report.warnings.filter(w => w.code === 'orphan_edit_history').length)
      .toBe(legacySnapshot.history.length);
    expect(first.report.unmapped.some(row => row.field === 'incidents.ai_summary')).toBe(true);
    expect(KNOWN_UNMAPPED_FIELDS).toContain('ai_summary');
    expect(first.warningsByClass.requires_handling).toBeGreaterThan(0);
    expect(first.report.warnings.some(w => w.code === 'duplicate_person_name')).toBe(true);
  });

  it('builds My Record as a projection without mutating the canonical source', () => {
    const source = [structuredClone(canonicalRecord)];
    const before = JSON.stringify(source);
    const included = buildDossierFromSource(source, defaultDossierConfig, [], new Date('2026-08-23T00:00:00.000Z'));
    const excluded = buildDossierFromSource([{ ...source[0], in_dossier: false }], defaultDossierConfig, [], new Date('2026-08-23T00:00:00.000Z'));

    expect(included.records[0].text).toBe(canonicalRecord.original_text);
    expect(excluded.records).toHaveLength(0);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('keeps Privacy Shield presentation-only', () => {
    localStorage.removeItem('chronicle-privacy-shield');
    const source = [structuredClone(canonicalRecord)];
    const before = JSON.stringify(source);
    const beforeDocument = buildDossierFromSource(source, defaultDossierConfig, [], new Date('2026-08-23T00:00:00.000Z'));
    const { result } = renderHook(() => usePrivacy(), { wrapper: PrivacyProvider });

    act(() => result.current.setEnabled(true));
    expect(result.current.maskName('Alex Smith')).not.toBe('Alex Smith');
    expect(result.current.maskFilename('alex-smith.jpg')).toBe('••••••.jpg');

    const afterDocument = buildDossierFromSource(source, defaultDossierConfig, [], new Date('2026-08-23T00:00:00.000Z'));
    expect(JSON.stringify(source)).toBe(before);
    expect(afterDocument).toEqual(beforeDocument);
    expect(afterDocument.records[0].text).toBe(canonicalRecord.original_text);
    localStorage.removeItem('chronicle-privacy-shield');
  });

  it('records the current five-minute media heuristic without endorsing it', () => {
    expect(ORIGINAL_EVIDENCE_WINDOW_MS).toBe(300_000);
    const roles = Object.fromEntries(
      toDossierSourceMedia(evidenceAtCurrentBoundaries, [productionIncident]).map(item => [item.id, item.role]),
    );
    expect(roles).toEqual({
      inside: 'original',
      'exact-boundary': 'original',
      outside: 'later',
      'invalid-time': 'later',
      'missing-time': 'original',
    });
  });

  it('builds an exact 500-attachment report baseline without data loss', () => {
    const media: DossierSourceMedia[] = Array.from({ length: 500 }, (_, index) => ({
      id: `media-${index}`,
      entry_id: canonicalRecord.id,
      kind: 'attachment',
      role: index < 250 ? 'original' : 'later',
      name: `file-${index}.pdf`,
      mime: 'application/pdf',
      size: 1_024,
      duration_ms: null,
      description: null,
      added_at: new Date(Date.parse(canonicalRecord.sealed_at) + index * 1_000).toISOString(),
      excluded_from_dossier: false,
    }));
    const started = performance.now();
    const document = buildDossierFromSource([canonicalRecord], defaultDossierConfig, media, new Date('2026-08-23T00:00:00.000Z'));
    const elapsed = performance.now() - started;

    expect(document.records[0].evidence).toHaveLength(500);
    expect(elapsed).toBeLessThan(8_000);
  });
});

