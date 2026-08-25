import type { CanonicalEntryBundle } from '@/chronicle/model/canonicalEntryReader';
import type { OriginalContentProvenance } from '@/chronicle/model/schema';
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

export const provenanceLabel = (provenance: OriginalContentProvenance | undefined): string => {
  if (!provenance || provenance.tracking_state === 'NOT_RECORDED') return 'Provenance not recorded';
  const helper = provenance.input_helper;
  if (!helper) return 'Provenance recorded';
  switch (helper.interaction_state) {
    case 'NOT_SHOWN': return 'Input Helper not shown';
    case 'SHOWN_NO_INTERACTION': return 'Input Helper shown; no interaction recorded';
    case 'INTERACTED_NO_ACCEPTANCE': return 'Input Helper interaction recorded; no suggestion acceptance recorded';
    case 'SUGGESTION_ACCEPTED': return `Structure assistance accepted before sealing${helper.accepted_suggestion_count ? ` · ${helper.accepted_suggestion_count} suggestion${helper.accepted_suggestion_count === 1 ? '' : 's'}` : ''}`;
  }
};

const historyLabel = (action: CanonicalEntryBundle['history'][number]['action']): string => ({
  sealed: 'Record sealed', input_helper_accepted: 'Structure assistance accepted before sealing',
  details_updated: 'Details updated', clarification_added: 'Clarification added',
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
    provenance_label: provenanceLabel(record.original.provenance),
    clarifications: bundle.clarifications.map(row => ({ id: row.id, text: row.text, created_at: row.created_at, kind: row.kind })),
    in_dossier: record.dossier.state === 'included', details,
  };
};

const fieldLabel: Record<string, string> = { title: 'Title', category_id: 'Category', context: 'Context', person_ids: 'People', location: 'Location', event_date: 'Event date', event_time: 'Event time' };

const helperHistoryNote = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { acceptedSuggestionCount?: number; helperVersion?: string };
    const parts: string[] = [];
    if (parsed.acceptedSuggestionCount) parts.push(`${parsed.acceptedSuggestionCount} suggestion${parsed.acceptedSuggestionCount === 1 ? '' : 's'} accepted`);
    if (parsed.helperVersion) parts.push(`Helper ${parsed.helperVersion}`);
    return parts.length ? parts.join(' · ') : null;
  } catch {
    return null;
  }
};

export const canonicalHistoryToItems = (bundle: CanonicalEntryBundle): RecordHistoryItem[] => bundle.history
  .filter(event => event.action !== 'sealed')
  .map(event => ({
    id: event.id,
    label: historyLabel(event.action),
    at: event.at,
    note: event.action === 'input_helper_accepted'
      ? helperHistoryNote(event.to_value)
      : event.field ? `${fieldLabel[event.field] ?? 'Details'} changed` : null,
  }));
