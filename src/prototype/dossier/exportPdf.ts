// Prototype-only PDF export. Manual A4 layout with jsPDF so chronology,
// wording and page numbering are fully deterministic.
import { jsPDF } from 'jspdf';
import type { DossierConfig, DossierDocumentModel } from './document';
import { safeFileName } from './document';

const M = 56;          // margin (pt) ≈ 20mm
const LEAD = 14;       // body line height

export function exportDossierPdf(doc: DossierDocumentModel, cfg: DossierConfig) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const CW = W - M * 2;
  const BOTTOM = H - M - 18;
  let y = M;

  const newPage = () => {
    pdf.addPage();
    y = M;
  };
  const need = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  const text = (
    s: string,
    opts: { size?: number; style?: 'normal' | 'bold' | 'italic'; gap?: number; indent?: number; color?: [number, number, number] } = {},
  ) => {
    const size = opts.size ?? 10.5;
    const indent = opts.indent ?? 0;
    pdf.setFont('helvetica', opts.style ?? 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...(opts.color ?? [25, 25, 25]));
    const lines = pdf.splitTextToSize(s, CW - indent) as string[];
    const lead = size * 1.35;
    lines.forEach(line => {
      need(lead);
      pdf.text(line, M + indent, y + size);
      y += lead;
    });
    y += opts.gap ?? 0;
  };

  const rule = (gapBefore = 6, gapAfter = 10) => {
    y += gapBefore;
    need(2);
    pdf.setDrawColor(200);
    pdf.setLineWidth(0.6);
    pdf.line(M, y, W - M, y);
    y += gapAfter;
  };

  const sectionHeading = (s: string) => {
    need(60);
    text(s.toUpperCase(), { size: 11, style: 'bold', gap: 2 });
    rule(2, 10);
  };

  /* ---------- Cover ---------- */
  y = H * 0.28;
  text(doc.title, { size: 24, style: 'bold', gap: 10 });
  text(doc.rangeLabel, { size: 12, color: [90, 90, 90], gap: 4 });
  text(`${doc.records.length} record${doc.records.length === 1 ? '' : 's'}`, { size: 12, color: [90, 90, 90], gap: 24 });
  text(`Generated ${doc.generatedLabel}`, { size: 9.5, color: [120, 120, 120] });
  text('Original wording preserved. Clarifications shown separately.', { size: 9.5, color: [120, 120, 120] });

  /* ---------- Contents ---------- */
  newPage();
  sectionHeading('Contents');
  doc.contents.forEach(c =>
    text(c.kind === 'record' ? `    ${c.label}` : c.label, { size: 10.5, gap: 2 }),
  );

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
    text(k, { size: 9, style: 'bold', color: [110, 110, 110] });
    text(v, { size: 10.5, gap: 8 });
  });

  /* ---------- Chronological record ---------- */
  newPage();
  sectionHeading('Chronological record');

  if (doc.records.length === 0) {
    text('No records are included in this document.', { size: 10.5, style: 'italic' });
  }

  doc.records.forEach((r, i) => {
    if (i > 0) y += 14;
    need(120); // keep a record heading with the start of its text
    text(r.heading, { size: 13, style: 'bold', gap: 2 });
    if (r.title) text(r.title, { size: 11, style: 'italic', gap: 2 });
    text(`Sealed ${r.sealedLabel}`, { size: 8.5, color: [120, 120, 120], gap: 6 });

    if (cfg.includeDetails && r.details.length > 0) {
      r.details.forEach(d => text(`${d.label}: ${d.value}`, { size: 9, color: [90, 90, 90] }));
      y += 6;
    }

    text('Original record', { size: 8.5, style: 'bold', color: [120, 120, 120], gap: 2 });
    r.text.split('\n').forEach(p => (p.trim() ? text(p, { size: 10.5, gap: 2 }) : (y += LEAD / 2)));

    if (cfg.includeClarifications && r.clarifications.length > 0) {
      y += 6;
      text('Clarifications added later', { size: 8.5, style: 'bold', color: [120, 120, 120], gap: 2 });
      r.clarifications.forEach(c => {
        need(40);
        text(c.label, { size: 8.5, color: [120, 120, 120], indent: 14 });
        text(c.text, { size: 10, indent: 14, gap: 4 });
      });
    }
    rule(10, 4);
  });

  /* ---------- Appendices ---------- */
  if (cfg.includeClarifications && doc.hasClarifications) {
    newPage();
    sectionHeading('Appendix A — Clarifications');
    text('Every clarification in this document, listed with the record it belongs to.', { size: 9.5, color: [110, 110, 110], gap: 10 });
    doc.records.filter(r => r.clarifications.length).forEach(r => {
      need(50);
      text(r.heading, { size: 10.5, style: 'bold', gap: 2 });
      r.clarifications.forEach(c => {
        text(c.label, { size: 8.5, color: [120, 120, 120], indent: 14 });
        text(c.text, { size: 10, indent: 14, gap: 6 });
      });
      y += 6;
    });
  }

  if (cfg.includeHistory && doc.records.length > 0) {
    newPage();
    sectionHeading('Appendix B — Record history');
    text('When each record was written, sealed and added to.', { size: 9.5, color: [110, 110, 110], gap: 10 });
    doc.records.forEach(r => {
      need(50);
      text(r.heading, { size: 10.5, style: 'bold', gap: 2 });
      r.history.forEach(h => text(h, { size: 9.5, indent: 14 }));
      y += 8;
    });
  }

  /* ---------- Integrity ---------- */
  newPage();
  sectionHeading('How this document was assembled');
  doc.integrity.forEach(p => text(p, { size: 10.5, gap: 8 }));

  /* ---------- Running header & footer ---------- */
  const pages = pdf.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text(doc.title, M, M - 22);
    pdf.setDrawColor(220);
    pdf.setLineWidth(0.5);
    pdf.line(M, M - 16, W - M, M - 16);
    pdf.text(`Page ${p} of ${pages}`, W - M, H - M + 6, { align: 'right' });
    pdf.text(`Generated ${doc.generatedLabel}`, M, H - M + 6);
  }

  pdf.save(`${safeFileName(doc.title)}.pdf`);
}
