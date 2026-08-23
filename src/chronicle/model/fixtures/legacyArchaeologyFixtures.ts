import type { V1Snapshot } from '@/chronicle/model/migrationPlan';
import type { EditHistoryRowLike } from '@/chronicle/shared/recordHistoryModel';
import type { DossierSourceRecord } from '@/chronicle/shared/dossierModel';
import type { LocalIncident } from '@/local/db';
import type { EvidenceFile } from '@/hooks/useEvidence';

const at = (minutes: number) => new Date(Date.parse('2025-03-14T10:00:00.000Z') + minutes * 60_000).toISOString();

const incident = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  user_id: 'owner-1',
  raw_narrative: `Original wording for ${id}`,
  record_type: 'incident',
  incident_date: '2025-03-14',
  incident_time: '09:30',
  people_involved: [],
  witnesses: [],
  excluded_from_rep: false,
  created_at: at(0),
  ...patch,
});

/** Deliberately awkward V1 material. These rows are synthetic and deterministic. */
export const legacySnapshot = {
  incidents: [
    incident('untouched'),
    incident('edited-complete', { people_involved: ['Alex Smith', 'alex smith'], ai_summary: 'Do not migrate me' }),
    incident('edited-incomplete', { incident_date: null, incident_time: 'half past nine', people_involved: ['Jordan Lee'] }),
    incident('same-name-person', { people_involved: ['Jordan Lee'], witnesses: ['Jordan Lee'] }),
    incident('daily', { record_type: 'daily_record', incident_date: null, record_date: '2025-03-15' }),
  ],
  notes: [
    { id: 'note-clarification', incident_id: 'untouched', note_text: 'Clarification', note_type: 'clarification', created_at: at(10) },
    { id: 'note-follow-up', incident_id: 'untouched', note_text: 'Follow-up', note_type: 'follow_up', created_at: at(20) },
    { id: 'note-outcome', incident_id: 'untouched', note_text: 'Outcome', note_type: 'outcome', created_at: at(30) },
    { id: 'note-correction', incident_id: 'untouched', note_text: 'Correction', note_type: 'correction', created_at: at(40) },
    { id: 'note-orphan', incident_id: 'missing-record', note_text: 'Orphan', note_type: 'clarification', created_at: at(50) },
  ],
  evidence: [
    { id: 'evidence-linked', incident_id: 'untouched', file_name: 'photo.jpg', file_path: 'owner-1/photo.jpg', file_hash: 'sha256-fixture', mime_type: 'image/jpeg', upload_date: at(1) },
    { id: 'evidence-no-hash', incident_id: 'untouched', file_name: 'voice.webm', file_path: 'owner-1/voice.webm', file_hash: null, mime_type: 'audio/webm', upload_date: at(6) },
    { id: 'evidence-orphan', incident_id: null, file_name: 'orphan.pdf', file_path: 'owner-1/orphan.pdf', file_hash: null, mime_type: 'application/pdf', upload_date: at(7) },
  ],
  history: [
    { id: 'history-complete', incident_id: 'edited-complete', field_changed: 'raw_narrative', changed_at: at(60), edit_source: 'user' },
    { id: 'history-incomplete', incident_id: 'edited-incomplete', field_changed: 'raw_narrative', changed_at: at(70), edit_source: null },
    { id: 'history-orphan', incident_id: 'missing-record', field_changed: 'category', changed_at: at(80), edit_source: 'user' },
  ],
} as unknown as V1Snapshot;

/** V1Snapshot cannot carry old/new values; the richer production-history shape can. */
export const wordingHistory: EditHistoryRowLike[] = [
  { id: 'complete', field_changed: 'raw_narrative', old_value: 'Earlier wording', new_value: 'Later wording', changed_at: at(60), edit_source: 'user' },
  { id: 'incomplete', field_changed: 'raw_narrative', old_value: null, new_value: null, changed_at: at(70), edit_source: 'legacy_migration' },
];

export const canonicalRecord: DossierSourceRecord = {
  id: 'untouched',
  title: 'A record',
  original_text: 'Alex Smith attended the meeting in Stirling.',
  sealed_at: at(0),
  captured_at: at(-2),
  event_date: '2025-03-14',
  event_time: '09:30',
  category: 'Workplace',
  context: 'Stirling office',
  people: ['Alex Smith'],
  clarifications: [{ id: 'clarification-1', text: 'Added later', created_at: at(10) }],
  in_dossier: true,
};

export const productionIncident = {
  id: 'untouched',
  raw_narrative: canonicalRecord.original_text,
  created_at: at(0),
  original_created_at: at(0),
} as unknown as LocalIncident;

const evidence = (id: string, upload_date: string | null | undefined) => ({
  id,
  incident_id: productionIncident.id,
  file_name: `${id}.jpg`,
  mime_type: 'image/jpeg',
  file_size: 100,
  upload_date,
  capture_date: null,
} as unknown as EvidenceFile);

export const evidenceAtCurrentBoundaries = [
  evidence('inside', at(4)),
  evidence('exact-boundary', at(5)),
  evidence('outside', new Date(Date.parse(at(5)) + 1).toISOString()),
  evidence('invalid-time', 'not-a-date'),
  evidence('missing-time', undefined),
];


