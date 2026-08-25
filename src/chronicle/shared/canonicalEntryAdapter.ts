import type { CanonicalEntryBundle } from '@/chronicle/model/canonicalEntryReader';
import type { SharedEntryView } from './EntryView';
import type { RecordHistoryItem } from './RecordHistoryView';

const eventDateLabel = (value: CanonicalEntryBundle['record']['details']['event_date']): string | null => {
  if (!value) return null;
  switch (value.kind) {
    case 'exact': return value.date;
    case 'approximate': return `Approx. ${value.date}${value.daypart ? ` · ${value.daypart}` : ''}`;
    case 'range': return `${value.start} – ${value.end}`;
    case 'unknown': return 'Unknown';
  }
};

const historyLabel = (action: CanonicalEntryBundle['history'][number]['action']): string => ({
  sealed: 'Record sealed', details_updated: 'Details updated', clarification_added: 'Clarification added',
  suggestion_provenance_recorded: 'Input Helper use recorded',
  media_added: 'Attachment added', media_excluded: 'Attachment excluded', media_included: 'Attachment included',
  dossier_included: 'Added to Chronicle', dossier_excluded: 'Removed from Chronicle', archived: 'Record archived',
  restored: 'Record restored', migrated_from_v1: 'Moved to the current Chronicle format',
})[action];

export const canonicalEntryToSharedView = (bundle: CanonicalEntryBundle): SharedEntryView => {
  const { record } = bundle;
  const details: Array<[string, string]> = [['Record type', record.kind === 'daily' ? 'Daily record' : 'Incident']];
  if (record.details.category_id) details.push(['Category', record.details.category_id]);
  if (record.details.context) details.push(['Context', record.details.context]);
  const date = eventDateLabel(record.details.event_date);
  if (date) details.push(['Event date', `${date}${record.details.event_time ? ` · ${record.details.event_time}` : ''}`]);
  if (record.details.location) details.push(['Location', record.details.location]);
  if (bundle.people.length) details.push(['People', bundle.people.map(person => person.display_name).join(', ')]);
  if (bundle.organisations.length) details.push(['Organisations', bundle.organisations.map(item => item.display_name).join(', ')]);
  return {
    id: record.id, title: record.details.title, original_text: record.original.text, sealed_at: record.sealed_at,
    clarifications: bundle.clarifications.map(row => ({ id: row.id, text: row.text, created_at: row.created_at, kind: row.kind })),
    in_dossier: record.dossier.state === 'included', details,
  };
};

const fieldLabel: Record<string, string> = { title: 'Title', category_id: 'Category', context: 'Context', person_ids: 'People', location: 'Location', event_date: 'Event date', event_time: 'Event time' };

export const canonicalHistoryToItems = (bundle: CanonicalEntryBundle): RecordHistoryItem[] => bundle.history
  .filter(event => event.action !== 'sealed')
  .map(event => ({ id: event.id, label: historyLabel(event.action), at: event.at, note: event.field ? `${fieldLabel[event.field] ?? 'Details'} changed` : null }));
