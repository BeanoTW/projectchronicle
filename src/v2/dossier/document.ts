// Chronicle V2 preview adapter over the shared, source-agnostic dossier model.
// The document model itself lives in ../shared/dossierModel (no Dexie there).
// This module maps the preview database rows (V2Entry / V2Media) onto it.
import type { V2Entry, V2Media } from '../db';
import {
  buildDossierFromSource,
  type DossierConfig,
  type DossierDocumentModel,
  type DossierSourceMedia,
  type DossierSourceRecord,
} from '../shared/dossierModel';

export * from '../shared/dossierModel';

export const toSourceRecord = (e: V2Entry): DossierSourceRecord => ({
  id: e.id,
  title: e.title,
  original_text: e.original_text,
  sealed_at: e.sealed_at,
  captured_at: e.captured_at,
  event_date: e.event_date,
  event_time: e.event_time,
  category: e.category,
  context: e.context,
  people: [...e.people],
  clarifications: e.clarifications.map(c => ({ id: c.id, text: c.text, created_at: c.created_at })),
  in_dossier: e.in_dossier,
});

export const toSourceMedia = (m: V2Media): DossierSourceMedia => ({
  id: m.id,
  entry_id: m.entry_id,
  kind: m.kind,
  role: m.role,
  name: m.name,
  mime: m.mime,
  size: m.size,
  duration_ms: m.duration_ms,
  description: m.description,
  added_at: m.added_at,
  excluded_from_dossier: m.excluded_from_dossier,
});

/** Preview-database entry point. Identical output to the production path. */
export function buildDossierDocument(
  all: V2Entry[],
  cfg: DossierConfig,
  media: V2Media[] = [],
  now: Date = new Date(),
): DossierDocumentModel {
  return buildDossierFromSource(all.map(toSourceRecord), cfg, media.map(toSourceMedia), now);
}
