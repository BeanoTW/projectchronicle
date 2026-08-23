// Phase 6 — canonical Notebook projection.
//
// This adapter consumes only the source-agnostic canonical contract. It does
// not know whether the records came from the V1 compatibility reader or the
// activated canonical store, so the activation router remains the sole cutover
// authority.
import type { V2Record } from '@/chronicle/model/schema';
import type { NotebookRecord } from './notebookModel';

const eventDateKey = (record: V2Record): string => {
  const value = record.details.event_date;
  if (!value || value.kind === 'unknown') return record.sealed_at.slice(0, 10);
  if (value.kind === 'range') return value.start;
  return value.date;
};

const inDossier = (record: V2Record): boolean => record.dossier.state === 'included';

export const canonicalRecordsToNotebookRecords = (
  records: readonly V2Record[],
  peopleById: ReadonlyMap<string, string> = new Map(),
): NotebookRecord[] => records
  .filter(record => record.lifecycle.state !== 'deleted_by_user')
  .map(record => {
    const people = record.details.person_ids
      .map(id => peopleById.get(id))
      .filter((name): name is string => Boolean(name));
    const source = record.original.source;

    return {
      id: record.id,
      title: record.details.title,
      preview: record.original.text,
      dateKey: eventDateKey(record),
      recordedAt: record.sealed_at,
      category: record.details.category_id,
      recordType: record.kind,
      searchExtras: [
        record.details.context ?? '',
        record.details.location ?? '',
        record.details.event_time ?? '',
      ].filter(Boolean),
      people,
      inDossier: inDossier(record),
      // Child-table enrichment remains separate. These fields deliberately
      // default to false/zero rather than reading legacy hooks after cutover.
      hasClarifications: false,
      clarificationCount: 0,
      hasVoice: source === 'voice' || source === 'written_and_voice',
      attachmentCount: record.original.media_ids.length,
      attachmentTypes: [],
      chips: [record.kind === 'daily' ? 'Daily record' : 'Incident'],
    } satisfies NotebookRecord;
  });
