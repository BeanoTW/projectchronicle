// Phase 6D — production data adapter for the shared V2 Dossier.
//
// Pure mapping functions over canonical production data:
//   - LocalIncident        (local-first records)
//   - LocalFollowUpNote    (clarifications added after the record was written)
//   - EvidenceFile         (Supabase-backed attachments)
//
// Inclusion mapping: production stores exclusion (`excluded_from_rep`).
// The V2 canonical model stores inclusion (`in_dossier`), so:
//     in_dossier === !excluded_from_rep
// and writing `in_dossier = X` persists `excluded_from_rep = !X`.
// No second membership field is introduced.
import type { LocalIncident } from '@/local/db';
import type { EvidenceFile } from '@/hooks/useEvidence';
import type { DossierSourceMedia, DossierSourceRecord } from '@/chronicle/shared/dossierModel';

export interface ProductionNote {
  id: string;
  incident_id: string;
  note_text: string;
  note_type?: string | null;
  created_at: string;
}

/**
 * Retained for source compatibility only. Phase 4 forbids using upload
 * proximity to infer whether legacy evidence was present when a record was
 * sealed. Legacy evidence remains unresolved unless explicit provenance exists.
 */
export const ORIGINAL_EVIDENCE_WINDOW_MS = 5 * 60 * 1000;

const isDaily = (i: LocalIncident) => (i as { record_type?: string }).record_type === 'daily_record';

/** Canonical event date for a production record. */
export const productionEventDate = (i: LocalIncident): string | null =>
  (isDaily(i) ? i.record_date : null) ?? i.incident_date ?? null;

export const mapInclusion = (excludedFromRep: boolean | null | undefined): boolean => !excludedFromRep;

export const inclusionToExcluded = (inDossier: boolean): boolean => !inDossier;

export interface DossierAdapterInput {
  incidents: LocalIncident[];
  notes: ProductionNote[];
}

/** Normalise production records into the source-agnostic dossier model. */
export const toDossierSourceRecords = ({ incidents, notes }: DossierAdapterInput): DossierSourceRecord[] => {
  const byIncident = new Map<string, ProductionNote[]>();
  notes.forEach(n => {
    const list = byIncident.get(n.incident_id) ?? [];
    list.push(n);
    byIncident.set(n.incident_id, list);
  });

  return incidents.map(i => {
    const sealedAt = i.original_created_at ?? i.created_at;
    return {
      id: i.id,
      title: i.title ?? null,
      // Original wording, exactly as recorded. Never rewritten for the document.
      original_text: i.raw_narrative ?? '',
      sealed_at: sealedAt,
      captured_at: i.original_created_at ?? i.created_at,
      event_date: productionEventDate(i),
      event_time: i.incident_time ?? null,
      category: i.category ?? null,
      context: i.context_domain ?? i.location ?? null,
      people: [...(i.people_involved ?? [])],
      clarifications: (byIncident.get(i.id) ?? [])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .map(n => ({ id: n.id, text: n.note_text, created_at: n.created_at })),
      in_dossier: mapInclusion(i.excluded_from_rep),
    } satisfies DossierSourceRecord;
  });
};

/** Normalise production evidence rows into source media. Voice notes are attachments here. */
export const toDossierSourceMedia = (
  evidence: EvidenceFile[],
  _incidents: LocalIncident[],
): DossierSourceMedia[] => evidence
  .filter(f => !!f.incident_id)
  .map(f => {
    const mime = (f.mime_type ?? '').toLowerCase();
    const added = f.upload_date ?? f.capture_date ?? new Date(0).toISOString();
    return {
      id: f.id,
      entry_id: f.incident_id as string,
      kind: mime.startsWith('audio/') ? 'voice' : 'attachment',
      // Legacy EvidenceFile has no authoritative field proving whether the file
      // was present at seal. Missing metadata must never become ORIGINAL.
      role: 'legacy_unresolved',
      name: f.file_name,
      mime: f.mime_type ?? '',
      size: Number(f.file_size ?? 0),
      duration_ms: null,
      description: f.description ?? null,
      added_at: added,
      // Production has no per-file dossier exclusion; inclusion follows the record.
      excluded_from_dossier: false,
    } satisfies DossierSourceMedia;
  })
  .sort((a, b) => a.added_at.localeCompare(b.added_at) || a.id.localeCompare(b.id));
