// Chronicle V2 (candidate) preview-database media writes (isolated `chronicle_prototype`).
// Pure helpers live in ./mediaCore and are shared with production capture.
import { v2DB, type V2Media, type MediaRole } from '../db';
import { attachmentType, type AttachmentType } from './mediaCore';

export * from './mediaCore';

export async function addMedia(params: {
  entry_id: string;
  kind: V2Media['kind'];
  role: MediaRole;
  name: string;
  mime: string;
  blob: Blob;
  description?: string | null;
  duration_ms?: number | null;
  added_at?: string;
}): Promise<V2Media> {
  const now = params.added_at ?? new Date().toISOString();
  const row: V2Media = {
    id: `pm-${crypto.randomUUID()}`,
    entry_id: params.entry_id,
    kind: params.kind,
    role: params.role,
    name: params.name,
    mime: params.mime,
    size: params.blob.size,
    duration_ms: params.duration_ms ?? null,
    description: params.description?.trim() || null,
    added_at: now,
    excluded_from_dossier: false,
    blob: params.blob,
  };
  await v2DB.media.add(row);
  await v2DB.media_events.add({
    id: `pe-${crypto.randomUUID()}`,
    media_id: row.id,
    entry_id: row.entry_id,
    at: now,
    action: 'added',
    detail: row.role === 'original' ? 'Present when the record was sealed' : 'Added after sealing',
  });
  return row;
}

export async function logMediaEvent(
  media: V2Media,
  action: 'described' | 'excluded' | 'included',
  detail: string | null = null,
) {
  await v2DB.media_events.add({
    id: `pe-${crypto.randomUUID()}`,
    media_id: media.id,
    entry_id: media.entry_id,
    at: new Date().toISOString(),
    action,
    detail,
  });
}

export const mediaForEntry = (entryId: string) =>
  v2DB.media.where('entry_id').equals(entryId).toArray();

/* ---------- Notebook summaries ---------- */
export interface EntryMediaSummary {
  hasVoice: boolean;
  attachmentCount: number;
  types: AttachmentType[];
}

export const emptySummary: EntryMediaSummary = { hasVoice: false, attachmentCount: 0, types: [] };

export function summariseMedia(rows: V2Media[]): Map<string, EntryMediaSummary> {
  const map = new Map<string, EntryMediaSummary>();
  rows.forEach(r => {
    const cur = map.get(r.entry_id) ?? { hasVoice: false, attachmentCount: 0, types: [] as AttachmentType[] };
    if (r.kind === 'voice') cur.hasVoice = true;
    else {
      cur.attachmentCount += 1;
      const t = attachmentType(r.mime, r.name);
      if (!cur.types.includes(t)) cur.types.push(t);
    }
    map.set(r.entry_id, cur);
  });
  return map;
}
