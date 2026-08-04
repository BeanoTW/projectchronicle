// Chronicle V2 (candidate): prepares image evidence for PDF/DOCX embedding.
// Images are decoded in the browser and re-encoded as JPEG at a bounded size so
// exports stay a sensible size and both exporters get a format they support.
// If an image cannot be decoded, it is simply omitted and the exporters fall back
// to a textual attachment reference.
import { v2DB } from '../db';
import type { DossierDocumentModel } from './document';

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  /** Raw bytes for DOCX embedding. */
  bytes: Uint8Array;
}

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
): Promise<Map<string, PreparedImage>> {
  const ids = doc.records.flatMap(r => r.evidence.filter(e => e.type === 'image').map(e => e.id));
  const map = new Map<string, PreparedImage>();
  if (ids.length === 0) return map;

  const rows = await v2DB.media.bulkGet(ids);
  for (const row of rows) {
    if (!row) continue;
    try {
      const img = await decode(row.blob);
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
      map.set(row.id, { dataUrl, width: w, height: h, bytes: toBytes(dataUrl) });
    } catch {
      /* Unreadable image — exporters fall back to a textual reference. */
    }
  }
  return map;
}
