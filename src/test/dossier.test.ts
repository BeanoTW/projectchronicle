// Phase 6D — Dossier migration tests.
// Cover the production adapter mapping, inclusion state, scope filters,
// clarification/evidence inclusion, document/preview consistency, export
// model creation, empty + large dossiers, and feature-flag independence.
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildDossierFromSource,
  defaultDossierConfig,
  matchesScope,
  recordDate,
  safeFileName,
  type DossierConfig,
  type DossierSourceMedia,
  type DossierSourceRecord,
} from '@/chronicle/shared/dossierModel';
import {
  inclusionToExcluded,
  mapInclusion,
  productionEventDate,
  toDossierSourceMedia,
  toDossierSourceRecords,
  ORIGINAL_EVIDENCE_WINDOW_MS,
} from '@/chronicle/shared/productionDossierAdapter';
import type { LocalIncident } from '@/local/db';
import type { EvidenceFile } from '@/hooks/useEvidence';

const cfg = (patch: Partial<DossierConfig> = {}): DossierConfig => ({ ...defaultDossierConfig, ...patch });

const incident = (patch: Partial<LocalIncident> = {}): LocalIncident => ({
  id: 'i1',
  user_id: 'u1',
  owner_user_id: 'u1',
  raw_narrative: 'Original wording that must never change.',
  incident_date: '2025-03-14',
  incident_time: '09:30',
  location: 'Meeting room 2',
  people_involved: ['Line manager'],
  witnesses: [],
  category: 'Exclusion',
  subtype: null,
  severity: null,
  impact_note: null,
  ai_summary: null,
  exact_words: null,
  tags: [],
  status: 'Open',
  locked: false,
  excluded_from_rep: false,
  record_method: 'text',
  title: 'Left out of meeting',
  created_at: '2025-03-14T10:00:00.000Z',
  updated_at: '2025-03-14T10:00:00.000Z',
  original_created_at: '2025-03-14T10:00:00.000Z',
  last_modified_at: '2025-03-14T10:00:00.000Z',
  voided_at: null,
  void_reason: null,
  context_domain: 'Workplace',
  category_source: 'ai',
  record_type: 'incident',
  interactions: null,
  record_date: null,
  transcription_source_attachment_id: null,
  transcription_created_at: null,
  transcription_provider: null,
  transcription_model: null,
  version: 1,
  sync_state: 'local_only',
  last_sync_attempt_at: null,
  last_sync_error: null,
  local_updated_at: '2025-03-14T10:00:00.000Z',
  ...patch,
} as LocalIncident);

const evidenceFile = (patch: Partial<EvidenceFile> = {}): EvidenceFile => ({
  id: 'e1',
  user_id: 'u1',
  incident_id: 'i1',
  file_name: 'photo.png',
  file_type: 'Photo',
  file_path: 'u1/photo.png',
  file_hash: null,
  mime_type: 'image/png',
  file_size: 2048,
  upload_date: '2025-03-14T10:01:00.000Z',
  capture_date: null,
  description: 'Screenshot',
  evidence_ref_number: 1,
  ...patch,
} as EvidenceFile);

const sourceRecord = (patch: Partial<DossierSourceRecord> = {}): DossierSourceRecord => ({
  id: 'r1',
  title: null,
  original_text: 'Text',
  sealed_at: '2025-03-14T10:00:00.000Z',
  captured_at: '2025-03-14T09:58:00.000Z',
  event_date: '2025-03-14',
  event_time: null,
  category: 'Exclusion',
  context: null,
  people: ['Line manager'],
  clarifications: [],
  in_dossier: true,
  ...patch,
});

/* ---------- Production adapter mapping ---------- */

describe('production dossier adapter', () => {
  it('maps a production record onto the source model without rewriting wording', () => {
    const [r] = toDossierSourceRecords({ incidents: [incident()], notes: [] });
    expect(r.original_text).toBe('Original wording that must never change.');
    expect(r.title).toBe('Left out of meeting');
    expect(r.event_date).toBe('2025-03-14');
    expect(r.event_time).toBe('09:30');
    expect(r.category).toBe('Exclusion');
    expect(r.context).toBe('Workplace');
    expect(r.people).toEqual(['Line manager']);
    expect(r.sealed_at).toBe('2025-03-14T10:00:00.000Z');
  });

  it('uses record_date as the event date for daily records', () => {
    const daily = incident({ record_type: 'daily_record', record_date: '2025-04-01' } as Partial<LocalIncident>);
    expect(productionEventDate(daily)).toBe('2025-04-01');
    expect(productionEventDate(incident())).toBe('2025-03-14');
  });

  it('attaches follow-up notes as clarifications in chronological order', () => {
    const [r] = toDossierSourceRecords({
      incidents: [incident()],
      notes: [
        { id: 'n2', incident_id: 'i1', note_text: 'Second', created_at: '2025-03-16T09:00:00.000Z' },
        { id: 'n1', incident_id: 'i1', note_text: 'First', created_at: '2025-03-15T09:00:00.000Z' },
      ],
    });
    expect(r.clarifications.map(c => c.text)).toEqual(['First', 'Second']);
  });

  it('maps evidence rows, classifying files by upload proximity to the record', () => {
    const late = new Date(Date.parse('2025-03-14T10:00:00.000Z') + ORIGINAL_EVIDENCE_WINDOW_MS + 1000).toISOString();
    const media = toDossierSourceMedia(
      [evidenceFile(), evidenceFile({ id: 'e2', upload_date: late, mime_type: 'audio/webm', file_name: 'voice.webm' })],
      [incident()],
    );
    expect(media[0]).toMatchObject({ id: 'e1', role: 'original', kind: 'attachment', entry_id: 'i1' });
    expect(media[1]).toMatchObject({ id: 'e2', role: 'later', kind: 'voice' });
  });

  it('uses friendly attachment labels in reports while retaining meaningful filenames', () => {
    const media = toDossierSourceMedia([
      evidenceFile({ file_name: '1787483198797455197993196562465.jpg', upload_date: '2026-08-23T12:07:04.000Z', evidence_ref_number: 2 }),
      evidenceFile({ id: 'e2', file_name: 'meeting-note.pdf', mime_type: 'application/pdf' }),
    ], [incident()]);
    expect(media.map(item => item.name)).toEqual(['meeting-note.pdf', 'Photo — 23 Aug 2026 (E02)']);
  });

  it('ignores evidence not linked to a record', () => {
    expect(toDossierSourceMedia([evidenceFile({ incident_id: null })], [incident()])).toHaveLength(0);
  });
});

/* ---------- Inclusion state mapping ---------- */

describe('inclusion mapping', () => {
  it('treats excluded_from_rep as the single membership field', () => {
    expect(mapInclusion(false)).toBe(true);
    expect(mapInclusion(true)).toBe(false);
    expect(mapInclusion(null)).toBe(true);
    expect(inclusionToExcluded(true)).toBe(false);
    expect(inclusionToExcluded(false)).toBe(true);
  });

  it('round-trips through the source model', () => {
    const [included] = toDossierSourceRecords({ incidents: [incident()], notes: [] });
    const [excluded] = toDossierSourceRecords({ incidents: [incident({ excluded_from_rep: true })], notes: [] });
    expect(included.in_dossier).toBe(true);
    expect(excluded.in_dossier).toBe(false);
    expect(buildDossierFromSource([included, excluded], cfg()).records).toHaveLength(1);
  });
});

/* ---------- Scope filters ---------- */

describe('scope filters', () => {
  const a = sourceRecord({ id: 'a', event_date: '2025-01-10', category: 'Exclusion', people: ['Sam'] });
  const b = sourceRecord({ id: 'b', event_date: '2025-06-10', category: 'Bullying', people: ['Alex'], sealed_at: '2025-06-10T10:00:00.000Z' });

  it('narrows by date, category and person', () => {
    expect(matchesScope(a, cfg({ from: '2025-02-01' }))).toBe(false);
    expect(matchesScope(b, cfg({ from: '2025-02-01' }))).toBe(true);
    expect(matchesScope(a, cfg({ category: 'Exclusion' }))).toBe(true);
    expect(matchesScope(b, cfg({ category: 'Exclusion' }))).toBe(false);
    expect(matchesScope(a, cfg({ person: 'Sam' }))).toBe(true);
    expect(matchesScope(b, cfg({ person: 'Sam' }))).toBe(false);
  });

  it('never changes membership — only visibility in the document', () => {
    const doc = buildDossierFromSource([a, b], cfg({ category: 'Exclusion' }));
    expect(doc.totalMembers).toBe(2);
    expect(doc.records).toHaveLength(1);
    expect(doc.hiddenByFilters).toBe(1);
  });

  it('falls back to the sealed date when no event date exists', () => {
    expect(recordDate(sourceRecord({ event_date: null }))).toBe('2025-03-14');
  });

  it('orders oldest-first or newest-first only', () => {
    const asc = buildDossierFromSource([b, a], cfg({ order: 'asc' })).records.map(r => r.id);
    const desc = buildDossierFromSource([a, b], cfg({ order: 'desc' })).records.map(r => r.id);
    expect(asc).toEqual(['a', 'b']);
    expect(desc).toEqual(['b', 'a']);
  });
});

/* ---------- Clarification + evidence inclusion ---------- */

describe('document content inclusion', () => {
  it('makes large contents lists identifiable by date, category and subject', () => {
    const doc = buildDossierFromSource([sourceRecord({
      title: 'Sick pay missing from final wage after repeated requests',
      category: 'Pay / Benefits',
      event_date: '2026-03-25',
    })], cfg());
    const recordLine = doc.contents.find(item => item.kind === 'record');
    expect(recordLine?.label).toBe('Record 1 — 25 March 2026 · Pay / Benefits · Sick pay missing from final wage after repeated requests');
  });

  const withClar = sourceRecord({
    clarifications: [{ id: 'c1', text: 'Added later', created_at: '2025-03-20T09:00:00.000Z' }],
  });
  const media: DossierSourceMedia[] = [
    { id: 'm1', entry_id: 'r1', kind: 'attachment', role: 'original', name: 'photo.png', mime: 'image/png', size: 2048, duration_ms: null, description: null, added_at: '2025-03-14T10:01:00.000Z', excluded_from_dossier: false },
    { id: 'm2', entry_id: 'r1', kind: 'voice', role: 'later', name: 'voice.webm', mime: 'audio/webm', size: 4096, duration_ms: 5000, description: null, added_at: '2025-03-16T10:01:00.000Z', excluded_from_dossier: false },
  ];

  it('keeps clarifications separate from the original wording', () => {
    const doc = buildDossierFromSource([withClar], cfg(), []);
    expect(doc.records[0].text).toBe('Text');
    expect(doc.records[0].clarifications[0].label).toContain('Clarification 1');
    expect(doc.hasClarifications).toBe(true);
    expect(doc.contents.some(c => c.label.startsWith('Appendix A'))).toBe(true);
  });

  it('honours evidence configuration', () => {
    expect(buildDossierFromSource([withClar], cfg(), media).records[0].evidence).toHaveLength(2);
    expect(buildDossierFromSource([withClar], cfg({ includeVoice: false }), media).records[0].evidence).toHaveLength(1);
    expect(buildDossierFromSource([withClar], cfg({ includeAttachments: false, includeVoice: false }), media).records[0].evidence).toHaveLength(0);
    expect(buildDossierFromSource([withClar], cfg({ attachmentTypes: ['document'] }), media).records[0].evidence.map(e => e.id)).toEqual(['m2']);
  });

  it('drops evidence for records that are not included', () => {
    const doc = buildDossierFromSource([sourceRecord({ in_dossier: false })], cfg(), media);
    expect(doc.records).toHaveLength(0);
    expect(doc.hasEvidence).toBe(false);
  });

  it('adds a record-history appendix only when requested', () => {
    expect(buildDossierFromSource([withClar], cfg()).contents.some(c => c.label.startsWith('Appendix B'))).toBe(false);
    expect(buildDossierFromSource([withClar], cfg({ includeHistory: true })).contents.some(c => c.label.startsWith('Appendix B'))).toBe(true);
  });
});

/* ---------- Preview / export model consistency ---------- */

describe('document model', () => {
  it('is identical for the preview and the export path', () => {
    const now = new Date('2025-07-01T12:00:00.000Z');
    const rows = [sourceRecord()];
    const preview = buildDossierFromSource(rows, cfg(), [], now);
    const forExport = buildDossierFromSource(rows, cfg(), [], now);
    expect(JSON.stringify(forExport)).toBe(JSON.stringify(preview));
  });

  it('always states generation time and makes no certification claim', () => {
    const doc = buildDossierFromSource([sourceRecord()], cfg(), [], new Date('2025-07-01T12:00:00.000Z'));
    expect(doc.generatedLabel).toContain('2025');
    expect(doc.integrity.some(p => p.includes('not a certified or legally verified document'))).toBe(true);
    expect(doc.integrity.join(' ')).not.toMatch(/legally certified|court-admissible/i);
  });

  it('produces a safe file name for PDF and DOCX writes', () => {
    expect(safeFileName('Chronological record')).toBe('chronological-record');
    expect(safeFileName('   ')).toBe('chronological-record');
    expect(safeFileName('///')).toBe('dossier');
  });

  it('handles an empty dossier without throwing', () => {
    const doc = buildDossierFromSource([], cfg());
    expect(doc.records).toHaveLength(0);
    expect(doc.totalMembers).toBe(0);
    expect(doc.rangeLabel).toBe('No records in range');
    expect(doc.people).toEqual([]);
  });

  it('handles a large dossier of several hundred records with long narratives', () => {
    const many: DossierSourceRecord[] = Array.from({ length: 400 }, (_, i) => sourceRecord({
      id: `r${i}`,
      sealed_at: new Date(Date.UTC(2025, 0, 1 + (i % 300), 9)).toISOString(),
      event_date: null,
      original_text: 'A '.repeat(4000),
      clarifications: Array.from({ length: 5 }, (__, c) => ({
        id: `r${i}-c${c}`, text: 'Follow up', created_at: new Date(Date.UTC(2025, 6, 1 + c)).toISOString(),
      })),
    }));
    const started = Date.now();
    const doc = buildDossierFromSource(many, cfg({ includeHistory: true }));
    expect(doc.records).toHaveLength(400);
    expect(doc.records[0].clarifications).toHaveLength(5);
    expect(doc.contents.length).toBeGreaterThan(400);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

/* ---------- Feature flag independence ---------- */


/* ---------- Source isolation ---------- */

describe('source isolation', () => {
  /** Source with comments stripped — prose mentions are fine, imports are not. */
  const imports = (p: string) =>
    readFileSync(p, 'utf8')
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
      .join('\n');

  it('shared dossier modules never import Dexie, Supabase or production hooks', () => {
    for (const f of [
      'src/chronicle/shared/dossierModel.ts',
      'src/chronicle/shared/DossierView.tsx',
      'src/chronicle/shared/DossierConfigureView.tsx',
      'src/chronicle/shared/DossierPreviewView.tsx',
    ]) {
      const src = imports(f);
      expect(src).not.toMatch(/dexie|supabase|@\/hooks\//i);
      expect(src).not.toMatch(/from '\.\.\/db'|from '\.\.\/media\/media'/);
    }
  });

  it('the production dossier adapter never imports the preview database', () => {
    const src = imports('src/chronicle/shared/productionDossierAdapter.ts');
    expect(src).not.toMatch(/chronicle_prototype|v2\/db|from '\.\.\/db'|dexie/i);
  });

  it('the shared exporters take a storage-agnostic blob loader', () => {
    for (const f of ['src/chronicle/dossier/exportPdf.ts', 'src/chronicle/dossier/exportDocx.ts']) {
      const src = imports(f);
      expect(src).toMatch(/loadBlob\?: LoadBlob/);
      expect(src).not.toMatch(/dexie|supabase/i);
    }
  });
});
