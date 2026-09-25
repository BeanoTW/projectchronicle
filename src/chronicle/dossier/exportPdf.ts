// Chronicle V2 (candidate). PDF export. Manual A4 layout with jsPDF so chronology,
// wording and page numbering are fully deterministic.
//
// Design: a cover in the Chronicle identity, a contents page with real page
// numbers, and the Chronicle spine drawn in the margin of every record. The
// spine is green beside original sealed wording and grey beside anything added
// later, so a reader can see at a glance what is original. Only built-in PDF
// fonts are used (Times for headings, Helvetica for text) so export works
// offline and renders identically everywhere.
import { jsPDF } from 'jspdf';
import type { DossierConfig, DossierDocumentModel } from '../shared/dossierModel';
import { safeFileName } from '../shared/dossierModel';
import { prepareEvidenceImages, type LoadBlob } from './evidenceImages';
import { deliverBlob, type Delivery } from './deliver';

type RGB = [number, number, number];

const M = 56;              // outer margin (pt) ≈ 20 mm
const GUTTER = 22;         // record content indent, leaves room for the spine
const SPINE_X = M + 7;     // x of the spine inside the record gutter

const INK: RGB = [17, 24, 33];
const INK_2: RGB = [58, 69, 81];
const MUTED: RGB = [95, 107, 119];
const LINE: RGB = [221, 227, 232];
const ACCENT: RGB = [31, 106, 83];
const SPINE_SOFT: RGB = [195, 204, 212];

type Bar = 'original' | 'added' | undefined;

export async function exportDossierPdf(
  doc: DossierDocumentModel,
  cfg: DossierConfig,
  loadBlob?: LoadBlob,
  onProgress?: (done: number, total: number) => void,
): Promise<Delivery> {
  const images = await prepareEvidenceImages(doc, loadBlob, onProgress);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const CW = W - M * 2;
  const BOTTOM = H - M - 18;
  let y = M;

  /** Heading of the record being laid out, for "(continued)" labels. */
  let continuing: string | null = null;
  const sectionPages = new Map<string, number>();
  const recordPages: number[] = [];

  const page = () => pdf.getNumberOfPages();

  const newPage = () => {
    pdf.addPage();
    y = M;
    if (continuing) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      pdf.text(`${continuing} (continued)`, M + GUTTER, y + 8.5);
      y += 20;
    }
  };
  const need = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  const drawBar = (bar: Bar, top: number, height: number) => {
    if (!bar) return;
    pdf.setLineCap('butt');
    if (bar === 'original') {
      pdf.setDrawColor(...ACCENT);
      pdf.setLineWidth(2);
    } else {
      pdf.setDrawColor(...SPINE_SOFT);
      pdf.setLineWidth(1.2);
    }
    pdf.line(SPINE_X, top, SPINE_X, top + height);
  };

  const text = (
    s: string,
    opts: {
      size?: number;
      style?: 'normal' | 'bold' | 'italic';
      font?: 'helvetica' | 'times';
      gap?: number;
      indent?: number;
      color?: RGB;
      lead?: number;
      bar?: Bar;
    } = {},
  ) => {
    const size = opts.size ?? 10.5;
    const indent = opts.indent ?? 0;
    pdf.setFont(opts.font ?? 'helvetica', opts.style ?? 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...(opts.color ?? INK));
    const lines = pdf.splitTextToSize(s, CW - indent) as string[];
    const lead = size * (opts.lead ?? 1.42);
    lines.forEach(line => {
      need(lead);
      // Font state can be changed by a page break's continuation label.
      pdf.setFont(opts.font ?? 'helvetica', opts.style ?? 'normal');
      pdf.setFontSize(size);
      pdf.setTextColor(...(opts.color ?? INK));
      drawBar(opts.bar, y, lead);
      pdf.text(line, M + indent, y + size);
      y += lead;
    });
    if (opts.gap) {
      if (BOTTOM - y > 0) drawBar(opts.bar, y, Math.min(opts.gap, BOTTOM - y));
      y += opts.gap;
    }
  };

  const spacer = (h: number, bar?: Bar) => {
    if (y + h > BOTTOM) return;
    drawBar(bar, y, h);
    y += h;
  };

  const sectionHeading = (label: string) => {
    need(80);
    sectionPages.set(label, page());
    pdf.setFont('times', 'normal');
    pdf.setFontSize(22);
    pdf.setTextColor(...INK);
    pdf.text(label, M, y + 20);
    y += 30;
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(1.6);
    pdf.line(M, y, M + 28, y);
    y += 18;
  };

  const small = (label: string, indent = 0, color: RGB = ACCENT, bar?: Bar) =>
    text(label, { size: 8, style: 'bold', color, indent, gap: 3, bar });

  // Vector rendition of the Chronicle mark: bound page, folded corner, spine
  // and three record nodes. No raster assets, so it stays sharp in print.
  const brandMark = (x: number, top: number, scale = 0.55) => {
    const sx = (n: number) => x + n * scale;
    const sy = (n: number) => top + n * scale;
    pdf.setLineCap('round');
    pdf.setLineJoin('round');
    pdf.setLineWidth(2 * scale);
    pdf.setDrawColor(...INK);
    pdf.line(sx(18), sy(7.5), sx(43.5), sy(7.5));
    pdf.line(sx(43.5), sy(7.5), sx(54), sy(18));
    pdf.line(sx(54), sy(18), sx(54), sy(56.5));
    pdf.line(sx(54), sy(56.5), sx(18), sy(56.5));
    pdf.line(sx(18), sy(56.5), sx(18), sy(7.5));
    pdf.line(sx(43.5), sy(7.5), sx(43.5), sy(18));
    pdf.line(sx(43.5), sy(18), sx(54), sy(18));
    pdf.setDrawColor(...ACCENT);
    pdf.line(sx(18), sy(15.5), sx(11.5), sy(15.5));
    pdf.line(sx(11.5), sy(15.5), sx(11.5), sy(48.5));
    pdf.line(sx(11.5), sy(48.5), sx(18), sy(48.5));
    pdf.setFillColor(...ACCENT);
    [19.5, 32, 44.5].forEach(n => pdf.circle(sx(11.5), sy(n), 2.6 * scale, 'F'));
  };

  const node = (cy: number, filled: boolean) => {
    pdf.setLineWidth(1.4);
    pdf.setDrawColor(...(filled ? ACCENT : SPINE_SOFT));
    pdf.setFillColor(...(filled ? ACCENT : ([255, 255, 255] as RGB)));
    pdf.circle(SPINE_X, cy, 3.6, 'FD');
  };

  /* ---------- Cover ---------- */
  brandMark(M, 70, 0.72);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(20);
  pdf.setTextColor(...INK);
  pdf.text('Chronicle', M + 52, 96);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  pdf.text('A chronological record', M + 52, 110);

  // A single spine runs down the cover's left edge, echoing the mark.
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(2);
  const coverSpineTop = H * 0.3;
  pdf.line(M - 26, coverSpineTop, M - 26, H - M - 40);
  pdf.setFillColor(...ACCENT);
  pdf.circle(M - 26, coverSpineTop, 4, 'F');

  y = coverSpineTop - 10;
  text(doc.title, { font: 'times', size: 36, lead: 1.08, gap: 14 });
  text(doc.rangeLabel, { size: 12.5, color: INK_2, gap: 30 });

  // Summary panel.
  const panelTop = y;
  const panelH = 64;
  pdf.setDrawColor(...LINE);
  pdf.setFillColor(248, 250, 251);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(M, panelTop, CW, panelH, 6, 6, 'FD');
  const cells: Array<[string, string]> = [
    ['Records', String(doc.records.length)],
    ['People named', String(doc.people.length)],
    ['Generated', doc.generatedLabel],
  ];
  const cellW = CW / cells.length;
  cells.forEach(([label, value], i) => {
    const cx = M + 16 + i * cellW;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(label, cx, panelTop + 24);
    pdf.setFont(i === 2 ? 'helvetica' : 'times', 'normal');
    pdf.setFontSize(i === 2 ? 10.5 : 20);
    pdf.setTextColor(...INK);
    const shown = pdf.splitTextToSize(value, cellW - 24) as string[];
    pdf.text(shown[0] ?? '', cx, panelTop + (i === 2 ? 44 : 48));
    if (i > 0) {
      pdf.setDrawColor(...LINE);
      pdf.line(M + i * cellW, panelTop + 12, M + i * cellW, panelTop + panelH - 12);
    }
  });

  // Cover statement.
  y = H - M - 70;
  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(1.6);
  pdf.line(M, y, M + 28, y);
  y += 12;
  text('Original wording preserved. Clarifications shown separately.', { size: 9.5, color: INK_2, gap: 2 });
  text(`Generated ${doc.generatedLabel}`, { size: 8.5, color: MUTED });

  /* ---------- Contents (page numbers filled in after layout) ---------- */
  newPage();
  sectionHeading('Contents');
  const contentsSlots: Array<{ page: number; y: number; textEnd: number; kind: 'section' | 'record'; label: string; recordIndex: number }> = [];
  let recordCounter = 0;
  doc.contents.forEach(c => {
    const isRecord = c.kind === 'record';
    const indent = isRecord ? 14 : 0;
    const size = isRecord ? 9.8 : 10.5;
    const style = isRecord ? 'normal' : 'bold';
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(c.label, CW - indent - 48) as string[];
    const lead = size * 1.45;
    need(lead * lines.length + (isRecord ? 2 : 8));
    if (!isRecord) y += 4;
    lines.forEach((line, i) => {
      pdf.setFont('helvetica', style);
      pdf.setFontSize(size);
      pdf.setTextColor(...(isRecord ? INK_2 : INK));
      pdf.text(line, M + indent, y + size);
      if (i === lines.length - 1) {
        contentsSlots.push({
          page: page(),
          y: y + size,
          textEnd: M + indent + pdf.getTextWidth(line),
          kind: c.kind,
          label: c.label,
          recordIndex: isRecord ? recordCounter : -1,
        });
      }
      y += lead;
    });
    if (isRecord) recordCounter += 1;
    y += isRecord ? 2 : 4;
  });

  /* ---------- Overview ---------- */
  newPage();
  sectionHeading('Overview');
  const overview: Array<[string, string]> = [
    ['Date range', doc.rangeLabel],
    ['Records included', String(doc.records.length)],
    ['People named', doc.people.length ? doc.people.join(', ') : 'None recorded'],
    ['Categories', doc.categories.length ? doc.categories.join(', ') : 'None recorded'],
  ];
  overview.forEach(([k, v]) => {
    need(40);
    const top = y;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(k, M, y + 10.5);
    const saved = y;
    y = top;
    text(v, { size: 10.5, indent: 130 });
    y = Math.max(y, saved + 18) + 8;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.5);
    pdf.line(M, y - 5, W - M, y - 5);
  });

  /* ---------- Chronological record ---------- */
  newPage();
  sectionHeading('Chronological record');

  if (doc.records.length === 0) {
    text('No records are included in this document.', { size: 10.5, style: 'italic' });
  }

  const recordIndent = GUTTER;
  const innerIndent = GUTTER + 14;

  doc.records.forEach((r, i) => {
    if (i > 0) y += 20;
    need(140);
    continuing = null;
    recordPages[i] = page();

    // Record header: node on the spine, serif heading.
    node(y + 9, true);
    text(r.heading, { font: 'times', size: 16, indent: recordIndent, lead: 1.2, gap: 1 });
    continuing = r.heading;
    if (r.title) text(r.title, { size: 11, style: 'bold', indent: recordIndent, gap: 1 });
    text(`Sealed ${r.sealedLabel}`, { size: 8.5, color: MUTED, indent: recordIndent, gap: 8 });

    if (cfg.includeDetails && r.details.length > 0) {
      r.details.forEach(d => {
        need(14);
        const top = y;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(...MUTED);
        pdf.text(d.label, M + recordIndent, y + 9);
        y = top;
        text(d.value, { size: 9, color: INK_2, indent: recordIndent + 92 });
      });
      y += 8;
    }

    // Original wording, marked by the green spine.
    small('Original record', recordIndent, ACCENT, 'original');
    r.text.split('\n').forEach(p => (p.trim()
      ? text(p, { size: 10.5, indent: recordIndent, gap: 2, bar: 'original' })
      : spacer(7, 'original')));

    if (cfg.includeClarifications && r.clarifications.length > 0) {
      spacer(8);
      small('Clarifications added later', recordIndent, MUTED, 'added');
      r.clarifications.forEach(c => {
        need(40);
        text(c.label, { size: 8.5, color: MUTED, indent: innerIndent, bar: 'added' });
        text(c.text, { size: 10, color: INK_2, indent: innerIndent, gap: 5, bar: 'added' });
      });
    }

    if (r.evidence.length > 0) {
      spacer(8);
      small('Evidence', recordIndent, MUTED);
      r.evidence.forEach(e => {
        const img = e.type === 'image' ? images.get(e.id) : undefined;
        if (img) {
          const maxW = CW - innerIndent;
          const maxH = 260;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          need(h + 30);
          try {
            pdf.setDrawColor(...LINE);
            pdf.setLineWidth(0.6);
            pdf.rect(M + innerIndent - 0.5, y - 0.5, w + 1, h + 1, 'S');
            pdf.addImage(img.dataUrl, 'JPEG', M + innerIndent, y, w, h);
            y += h + 5;
          } catch {
            /* fall through to the textual reference below */
          }
        }
        const meta = [e.typeLabel, e.name, e.sizeLabel, e.durationLabel].filter(Boolean).join(' · ');
        text(meta, { size: 8.5, color: INK_2, indent: innerIndent });
        if (e.description) text(e.description, { size: 9.5, indent: innerIndent });
        text(`${e.roleLabel} · added ${e.addedLabel}`, { size: 8.5, color: MUTED, indent: innerIndent, gap: 5 });
      });
      text('File contents have not been analysed or verified.', { size: 8, style: 'italic', color: MUTED, indent: innerIndent, gap: 2 });
    }

    continuing = null;
    y += 8;
    need(4);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.6);
    pdf.line(M + recordIndent, y, W - M, y);
  });

  /* ---------- Appendices ---------- */
  if (cfg.includeClarifications && doc.hasClarifications) {
    newPage();
    sectionHeading('Appendix A — Clarifications');
    text('Every clarification in this document, listed with the record it belongs to.', { size: 9.5, color: MUTED, gap: 12 });
    doc.records.filter(r => r.clarifications.length).forEach(r => {
      need(50);
      text(r.heading, { font: 'times', size: 13, gap: 3 });
      r.clarifications.forEach(c => {
        text(c.label, { size: 8.5, color: MUTED, indent: 14 });
        text(c.text, { size: 10, indent: 14, gap: 6 });
      });
      y += 8;
    });
  }

  if (cfg.includeHistory && doc.records.length > 0) {
    newPage();
    sectionHeading('Appendix B — Record history');
    text('When each record was written, sealed and added to.', { size: 9.5, color: MUTED, gap: 12 });
    doc.records.forEach(r => {
      need(50);
      text(r.heading, { font: 'times', size: 13, gap: 3 });
      r.history.forEach(h => text(h, { size: 9.5, color: INK_2, indent: 14 }));
      y += 10;
    });
  }

  /* ---------- Integrity ---------- */
  newPage();
  sectionHeading('How this document was assembled');
  doc.integrity.forEach((p, i) => {
    need(40);
    const top = y;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(...ACCENT);
    pdf.text(String(i + 1), M, y + 11);
    y = top;
    text(p, { size: 10.5, indent: 22, gap: 9 });
  });

  /* ---------- Fill in contents page numbers ---------- */
  const pageForSlot = (slot: (typeof contentsSlots)[number]): number | undefined =>
    slot.kind === 'record' ? recordPages[slot.recordIndex] : sectionPages.get(slot.label);
  contentsSlots.forEach(slot => {
    const target = pageForSlot(slot);
    if (!target) return;
    pdf.setPage(slot.page);
    pdf.setFont('helvetica', slot.kind === 'record' ? 'normal' : 'bold');
    pdf.setFontSize(slot.kind === 'record' ? 9.8 : 10.5);
    pdf.setTextColor(...(slot.kind === 'record' ? INK_2 : INK));
    const label = String(target);
    const numberX = W - M;
    pdf.text(label, numberX, slot.y, { align: 'right' });
    // Dotted leader between the entry and its page number.
    const from = slot.textEnd + 6;
    const to = numberX - pdf.getTextWidth(label) - 6;
    if (to > from) {
      pdf.setFillColor(...SPINE_SOFT);
      for (let x = from; x < to; x += 4) pdf.circle(x, slot.y - 2.6, 0.55, 'F');
    }
  });

  /* ---------- Running header & footer ---------- */
  const pages = pdf.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFillColor(...ACCENT);
    pdf.circle(M + 2.5, M - 25, 2.5, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(`Chronicle · ${doc.title}`, M + 10, M - 22);
    pdf.text(doc.rangeLabel, W - M, M - 22, { align: 'right' });
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.5);
    pdf.line(M, M - 14, W - M, M - 14);
    pdf.line(M, H - M + 2 - 10, W - M, H - M + 2 - 10);
    pdf.text(`Page ${p} of ${pages}`, W - M, H - M + 6, { align: 'right' });
    pdf.text(`Generated ${doc.generatedLabel}`, M, H - M + 6);
  }

  return deliverBlob(pdf.output('blob'), `${safeFileName(doc.title)}.pdf`);
}