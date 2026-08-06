// Phase 6B — production data adapter for the shared V2 Notebook.
//
// Reads ONLY canonical production data through existing hooks:
//   - useIncidents          (local-first Dexie records)
//   - useAllFollowUpNotes   (clarification presence)
//   - useEvidence           (attachment counts; optional, Supabase-backed)
// Read-only: no mutations, no dossier toggling, no preview database.
import type { LocalIncident } from '@/local/db';
import type { EvidenceFile } from '@/hooks/useEvidence';
import type { NotebookRecord } from '@/v2/shared/notebookModel';
import type { AttachmentType } from '@/v2/media/media';

const evidenceType = (f: EvidenceFile): AttachmentType => {
  const m = (f.mime_type ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf' || m.startsWith('text/') || m.includes('word') || m.includes('officedocument')) {
    return 'document';
  }
  return 'other';
};

const firstLine = (text: string): string => {
  const line = (text ?? '').trim().split('\n').find(l => l.trim().length > 0) ?? '';
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
};

export interface AdapterInput {
  incidents: LocalIncident[];
  notes: Array<{ incident_id: string }>;
  evidence?: EvidenceFile[];
}

/** Normalise production records into the source-agnostic notebook model. */
export const toNotebookRecords = ({ incidents, notes, evidence }: AdapterInput): NotebookRecord[] => {
  const noteCounts = new Map<string, number>();
  notes.forEach(n => noteCounts.set(n.incident_id, (noteCounts.get(n.incident_id) ?? 0) + 1));

  const attachments = new Map<string, { count: number; types: Set<AttachmentType> }>();
  (evidence ?? []).forEach(f => {
    if (!f.incident_id) return;
    const cur = attachments.get(f.incident_id) ?? { count: 0, types: new Set<AttachmentType>() };
    cur.count += 1;
    cur.types.add(evidenceType(f));
    attachments.set(f.incident_id, cur);
  });

  return incidents.map(i => {
    const clar = noteCounts.get(i.id) ?? 0;
    const att = attachments.get(i.id);
    const isDaily = (i as { record_type?: string }).record_type === 'daily_record';
    const chips = [isDaily ? 'Daily record' : 'Incident'];
    if (i.status && i.status !== 'Open') chips.push(i.status);

    return {
      id: i.id,
      title: i.title || firstLine(i.raw_narrative) || null,
      preview: i.raw_narrative ?? '',
      // Canonical event date: record_date for daily records, else incident_date.
      dateKey: ((isDaily ? i.record_date : null) ?? i.incident_date ?? (i.created_at ?? '').slice(0, 10)),
      recordedAt: i.original_created_at ?? i.created_at,
      category: i.category ?? null,
      searchExtras: [
        i.subtype ?? '', i.location ?? '', i.context_domain ?? '',
        i.exact_words ?? '', i.impact_note ?? '', ...(i.tags ?? []),
      ].filter(Boolean),
      people: [...(i.people_involved ?? [])],
      // Production inclusion field: excluded_from_rep.
      inDossier: !i.excluded_from_rep,
      hasClarifications: clar > 0,
      clarificationCount: clar,
      hasVoice: i.record_method === 'voice',
      attachmentCount: att?.count ?? 0,
      attachmentTypes: att ? Array.from(att.types) : [],
      chips,
    } satisfies NotebookRecord;
  });
};
