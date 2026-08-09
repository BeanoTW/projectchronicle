// Phase 8 — V2 performance harness.
//
// Measures the pure data paths behind Notebook, Entry, My Record and the
// report at 100 / 1,000 / 5,000 records. Timings are printed so a run can be
// compared over time; assertions guard only against order-of-magnitude
// regressions so the suite stays stable on slower CI machines.
import { describe, it, expect } from 'vitest';
import { buildScaleDataset } from '@/chronicle/model/fixtures/scaleDataset';
import { toNotebookRecords } from '@/chronicle/shared/productionNotebookAdapter';
import { toDossierSourceMedia, toDossierSourceRecords } from '@/chronicle/shared/productionDossierAdapter';
import { buildDossierFromSource, defaultDossierConfig } from '@/chronicle/shared/dossierModel';
import { emptyFilters as defaultFilters } from '@/chronicle/filters';
import { monthCounts, recordMatchesFilters, recordMatchesSearch, sortByRecency } from '@/chronicle/shared/notebookModel';
import { planMigration } from '@/chronicle/model/migrationPlan';

const SIZES = [100, 1000, 5000];
const results: string[] = [];

const time = (label: string, fn: () => void): number => {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  results.push(`${label.padEnd(46)} ${ms.toFixed(1)} ms`);
  return ms;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const asIncidents = (d: ReturnType<typeof buildScaleDataset>) => d.incidents as any[];
const asNotes = (d: ReturnType<typeof buildScaleDataset>) =>
  d.notes.map(n => ({ id: n.id, incident_id: n.incident_id, note_text: n.note_text, note_type: n.note_type, created_at: n.created_at })) as any[];
const asEvidence = (d: ReturnType<typeof buildScaleDataset>) => d.evidence as any[];

describe('Phase 8 — V2 performance at scale', () => {
  SIZES.forEach(size => {
    it(`notebook paths stay responsive at ${size} records`, () => {
      const data = buildScaleDataset(size);
      let rows: ReturnType<typeof toNotebookRecords> = [];

      const load = time(`Notebook initial load (${size})`, () => {
        rows = sortByRecency(toNotebookRecords({ incidents: asIncidents(data), notes: asNotes(data), evidence: asEvidence(data) }));
      });
      time(`Notebook search (${size})`, () => { rows.filter(r => recordMatchesSearch(r, 'Reference 42')); });
      time(`Notebook category filter (${size})`, () => {
        const f = { ...defaultFilters, categories: ['Conduct'] };
        rows.filter(r => recordMatchesFilters(r, f));
      });
      time(`Notebook people filter (${size})`, () => {
        const f = { ...defaultFilters, people: ['A. Fielding'] };
        rows.filter(r => recordMatchesFilters(r, f));
      });
      time(`Notebook record-type filter (${size})`, () => {
        const f = { ...defaultFilters, recordTypes: ['daily' as const] };
        rows.filter(r => recordMatchesFilters(r, f));
      });
      time(`Notebook date-range filter (${size})`, () => {
        const f = { ...defaultFilters, from: '2023-01-01', to: '2023-12-31' };
        rows.filter(r => recordMatchesFilters(r, f));
      });
      time(`Notebook clarification filter (${size})`, () => {
        const f = { ...defaultFilters, withClarifications: true };
        rows.filter(r => recordMatchesFilters(r, f));
      });
      time(`Notebook month switch (${size})`, () => { monthCounts(rows, '2023-05'); });
      time(`Entry open — largest record (${size})`, () => {
        const biggest = rows.reduce((a, b) => (b.preview.length > a.preview.length ? b : a), rows[0]);
        expect(biggest.preview.length).toBeGreaterThan(0);
      });

      expect(rows).toHaveLength(size);
      expect(load).toBeLessThan(4000);
    });

    it(`My Record and report generation stay responsive at ${size} records`, () => {
      const data = buildScaleDataset(size);
      const records = toDossierSourceRecords({ incidents: asIncidents(data), notes: asNotes(data) });
      const media = toDossierSourceMedia(asEvidence(data), asIncidents(data));

      time(`My Record configure load (${size})`, () => {
        records.filter(r => r.in_dossier).length;
      });
      time(`My Record inclusion toggle (${size})`, () => {
        const next = records.map(r => (r.id === records[0].id ? { ...r, in_dossier: !r.in_dossier } : r));
        expect(next).toHaveLength(records.length);
      });
      const preview = time(`Report preview build (${size})`, () => {
        buildDossierFromSource(records, defaultDossierConfig, media);
      });
      time(`Migration dry run (${size})`, () => { planMigration(data); });

      expect(preview).toBeLessThan(8000);
    });
  });

  it('report scales from 1 to 500 included records without loss', () => {
    const data = buildScaleDataset(1000);
    const all = toDossierSourceRecords({ incidents: asIncidents(data), notes: asNotes(data) });
    const media = toDossierSourceMedia(asEvidence(data), asIncidents(data));

    [1, 100, 500].forEach(n => {
      const subset = all.slice(0, n).map(r => ({ ...r, in_dossier: true }));
      const doc = time(`Report model — ${n} included records`, () => {
        const d = buildDossierFromSource(subset, defaultDossierConfig, media);
        expect(d.records).toHaveLength(n);
      });
      expect(doc).toBeLessThan(8000);
    });
  });

  it('unsupported evidence is listed, never fatal', () => {
    const data = buildScaleDataset(100);
    const records = toDossierSourceRecords({ incidents: asIncidents(data), notes: asNotes(data) })
      .map(r => ({ ...r, in_dossier: true }));
    const media = toDossierSourceMedia(asEvidence(data), asIncidents(data));
    const doc = buildDossierFromSource(records, defaultDossierConfig, media);
    const items = doc.records.flatMap(r => r.evidence);
    expect(items.some(i => i.name.endsWith('.xyz'))).toBe(true);
    expect(items.every(i => typeof i.typeLabel === 'string' && i.typeLabel.length > 0)).toBe(true);
  });

  it('prints the measured timings', () => {
    // eslint-disable-next-line no-console
    console.log('\n--- Phase 8 performance ---\n' + results.join('\n') + '\n');
    expect(results.length).toBeGreaterThan(0);
  });
});
