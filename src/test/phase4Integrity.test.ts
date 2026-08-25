import { describe, expect, it } from 'vitest';
import {
  buildDossierFromSource,
  compareDossierRecords,
  defaultDossierConfig,
  evidenceForRecord,
  recordDate,
  type DossierSourceRecord,
} from '@/chronicle/shared/dossierModel';

const record = (patch: Partial<DossierSourceRecord> = {}): DossierSourceRecord => ({
  id: 'r1',
  title: null,
  original_text: 'Original',
  sealed_at: '2026-03-08T10:00:00.000Z',
  captured_at: '2026-03-08T09:59:00.000Z',
  event_date: null,
  event_time: null,
  category: null,
  context: null,
  people: [],
  clarifications: [],
  in_dossier: true,
  ...patch,
});

describe('Phase 4 chronological and integrity contract', () => {
  it('keeps a missing event date missing', () => {
    const source = record();
    expect(recordDate(source)).toBeNull();
    const doc = buildDossierFromSource([source], defaultDossierConfig);
    expect(doc.records[0].dateLabel).toBe('Date not recorded');
    expect(doc.records[0].details.some(detail => detail.label === 'Date of event')).toBe(false);
  });

  it('orders dated records by event date rather than seal date', () => {
    const earlyEventLateSeal = record({ id: 'a', event_date: '2026-03-03', sealed_at: '2026-03-20T10:00:00.000Z' });
    const lateEventEarlySeal = record({ id: 'b', event_date: '2026-03-14', sealed_at: '2026-03-15T10:00:00.000Z' });
    expect([lateEventEarlySeal, earlyEventLateSeal].sort(compareDossierRecords).map(item => item.id)).toEqual(['a', 'b']);
  });

  it('uses event time when both records have it, then sealed timestamp and stable id', () => {
    const base = { event_date: '2026-03-14' };
    const laterTime = record({ ...base, id: 'z', event_time: '11:00', sealed_at: '2026-03-20T10:00:00.000Z' });
    const earlierTime = record({ ...base, id: 'y', event_time: '09:00', sealed_at: '2026-03-20T10:00:00.000Z' });
    expect([laterTime, earlierTime].sort(compareDossierRecords).map(item => item.id)).toEqual(['y', 'z']);

    const laterSeal = record({ ...base, id: 'later-seal', event_time: null, sealed_at: '2026-03-20T11:00:00.000Z' });
    const earlierSeal = record({ ...base, id: 'earlier-seal', event_time: null, sealed_at: '2026-03-20T10:00:00.000Z' });
    expect([laterSeal, earlierSeal].sort(compareDossierRecords).map(item => item.id)).toEqual(['earlier-seal', 'later-seal']);

    const sameA = record({ ...base, id: 'a', event_time: null, sealed_at: '2026-03-20T10:00:00.000Z' });
    const sameB = record({ ...base, id: 'b', event_time: null, sealed_at: '2026-03-20T10:00:00.000Z' });
    expect([sameB, sameA].sort(compareDossierRecords).map(item => item.id)).toEqual(['a', 'b']);
  });

  it('places unknown-date records after dated records in their sealing month deterministically', () => {
    const dated = record({ id: 'dated', event_date: '2026-03-29', sealed_at: '2026-03-30T10:00:00.000Z' });
    const unknownEarly = record({ id: 'unknown-a', event_date: null, sealed_at: '2026-03-08T10:00:00.000Z' });
    const unknownLate = record({ id: 'unknown-b', event_date: null, sealed_at: '2026-03-21T10:00:00.000Z' });
    const doc = buildDossierFromSource([unknownLate, dated, unknownEarly], defaultDossierConfig);
    expect(doc.records.map(item => item.id)).toEqual(['dated', 'unknown-a', 'unknown-b']);
  });

  it('uses the same ordered document model for preview and export consumers', () => {
    const rows = [
      record({ id: 'unknown', event_date: null }),
      record({ id: 'dated', event_date: '2026-03-03', sealed_at: '2026-03-20T10:00:00.000Z' }),
    ];
    const doc = buildDossierFromSource(rows, defaultDossierConfig, [], new Date('2026-04-01T12:00:00.000Z'));
    expect(doc.records.map(item => item.id)).toEqual(['dated', 'unknown']);
    expect(doc.integrity.join(' ')).toContain('A sealing date is not treated as an event date.');
  });

  it('does not collapse unresolved legacy media to original', () => {
    const evidence = evidenceForRecord([
      {
        id: 'legacy-media', entry_id: 'r1', kind: 'attachment', role: 'legacy_unresolved',
        name: 'legacy.pdf', mime: 'application/pdf', size: 12, duration_ms: null,
        description: null, added_at: '2026-03-08T10:00:00.000Z', excluded_from_dossier: false,
      },
    ], 'r1', defaultDossierConfig);
    expect(evidence[0].role).toBe('legacy_unresolved');
    expect(evidence[0].roleLabel).toContain('not recorded');
    expect(evidence[0].roleLabel).not.toContain('Present when');
  });
});
