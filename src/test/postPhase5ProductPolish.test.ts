import { describe, expect, it } from 'vitest';
import { buildDossierFromSource, defaultDossierConfig, type DossierSourceRecord } from '@/chronicle/shared/dossierModel';
import { toDossierSourceMedia } from '@/chronicle/shared/productionDossierAdapter';
import type { EvidenceFile } from '@/hooks/useEvidence';

const sourceRecord = (patch: Partial<DossierSourceRecord> = {}): DossierSourceRecord => ({
  id: 'r1',
  title: 'Sick pay missing from final wage after repeated requests',
  original_text: 'Sick pay missing from final wage after repeated requests',
  sealed_at: '2026-03-25T10:00:00.000Z',
  captured_at: '2026-03-25T09:58:00.000Z',
  event_date: '2026-03-25',
  event_time: null,
  category: 'Pay / Benefits',
  context: null,
  people: [],
  clarifications: [],
  in_dossier: true,
  ...patch,
});

describe('post-Phase-5 product polish', () => {
  it('makes report contents identifiable without changing record wording', () => {
    const record = sourceRecord();
    const doc = buildDossierFromSource([record], defaultDossierConfig);
    const line = doc.contents.find(item => item.kind === 'record');

    expect(line?.label).toBe(
      'Record 1 — 25 March 2026 · Pay / Benefits · Sick pay missing from final wage after repeated requests',
    );
    expect(doc.records[0].text).toBe(record.original_text);
  });

  it('uses a friendly label for opaque legacy attachment filenames without inventing provenance', () => {
    const evidence = {
      id: 'e1',
      incident_id: 'r1',
      display_name: null,
      file_name: '1787483198797455197993196562465.jpg',
      file_type: 'Photo',
      mime_type: 'image/jpeg',
      file_size: 2048,
      upload_date: '2026-08-23T12:07:04.000Z',
      capture_date: null,
      evidence_ref_number: 2,
      description: null,
    } as EvidenceFile;

    const [mapped] = toDossierSourceMedia([evidence], []);
    expect(mapped.name).toBe('Photo — 23 Aug 2026 (E02)');
    expect(mapped.role).toBe('legacy_unresolved');
  });
});
