// Chronicle V2: prepares image evidence for PDF/DOCX embedding.
// Storage-agnostic — the caller supplies a `loadBlob` resolver (preview Dexie
// or production Supabase storage). Images are decoded in the browser and
// re-encoded as JPEG at a bounded size so exports stay a sensible size.
// If an image cannot be loaded or decoded it is omitted and the exporters
// fall back to a textual attachment reference.
import type { DossierDocumentModel } from '../shared/dossierModel';

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  /** Raw bytes for DOCX embedding. */
  bytes: Uint8Array;
}

export type LoadBlob = (mediaId: string) => Promise<Blob | null>;

const MAX_EDGE = 1200;

const decode = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });

const toBytes = (dataUrl: string): Uint8Array => {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export async function prepareEvidenceImages(
  doc: DossierDocumentModel,
  loadBlob?: LoadBlob,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, PreparedImage>> {
  const ids = doc.records.flatMap(r => r.evidence.filter(e => e.type === 'image').map(e => e.id));
  const map = new Map<string, PreparedImage>();
  if (ids.length === 0 || !loadBlob) return map;

  let done = 0;
  for (const id of ids) {
    try {
      const blob = await loadBlob(id);
      if (!blob) continue;
      const img = await decode(blob);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      map.set(id, { dataUrl, width: w, height: h, bytes: toBytes(dataUrl) });
    } catch {
      /* Unreadable image — exporters fall back to a textual reference. */
    } finally {
      done += 1;
      onProgress?.(done, ids.length);
    }
  }
  return map;
}

/** Loads image blobs from the V2 preview database. Preview-only. */
export const previewLoadBlob: LoadBlob = async (mediaId) => {
  const { v2DB } = await import('../db');
  const row = await v2DB.media.get(mediaId);
  return row?.blob ?? null;
};
