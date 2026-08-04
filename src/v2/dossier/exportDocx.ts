// Chronicle V2 (candidate). Word export. Mirrors the on-screen preview and the PDF.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Header, Footer, PageNumber, PageBreak, BorderStyle, TabStopType, TabStopPosition, ImageRun,
} from 'docx';
import type { DossierConfig, DossierDocumentModel } from './document';
import { safeFileName } from './document';
import { prepareEvidenceImages } from './evidenceImages';

const body = (text: string, opts: Partial<{ size: number; bold: boolean; italics: boolean; color: string; indent: number; after: number }> = {}) =>
  new Paragraph({
    indent: opts.indent ? { left: opts.indent } : undefined,
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({
      text,
      size: opts.size ?? 22,
      bold: opts.bold,
      italics: opts.italics,
      color: opts.color ?? '1A1A1A',
      font: 'Arial',
    })],
  });

const sectionHeading = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF', space: 6 } },
    children: [new TextRun({ text, size: 26, bold: true, font: 'Arial' })],
  });

export async function exportDossierDocx(doc: DossierDocumentModel, cfg: DossierConfig) {
  const children: Paragraph[] = [];
  const images = await prepareEvidenceImages(doc);

  /* Cover */
  children.push(
    new Paragraph({ spacing: { before: 2400, after: 240 }, alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: doc.title, size: 52, bold: true, font: 'Arial' })] }),
    body(doc.rangeLabel, { size: 24, color: '5A5A5A' }),
    body(`${doc.records.length} record${doc.records.length === 1 ? '' : 's'}`, { size: 24, color: '5A5A5A', after: 480 }),
    body(`Generated ${doc.generatedLabel}`, { size: 19, color: '767676' }),
    body('Original wording preserved. Clarifications shown separately.', { size: 19, color: '767676' }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  /* Contents */
  children.push(sectionHeading('Contents'));
  doc.contents.forEach(c => children.push(body(c.label, { indent: c.kind === 'record' ? 360 : 0, after: 60 })));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  /* Overview */
  children.push(sectionHeading('Overview'));
  ([
    ['Date range', doc.rangeLabel],
    ['Records included', String(doc.records.length)],
    ['People named', doc.people.length ? doc.people.join(', ') : 'None recorded'],
    ['Categories', doc.categories.length ? doc.categories.join(', ') : 'None recorded'],
  ] as Array<[string, string]>).forEach(([k, v]) => {
    children.push(body(k, { size: 18, bold: true, color: '6E6E6E', after: 40 }));
    children.push(body(v, { after: 180 }));
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));

  /* Chronological record */
  children.push(sectionHeading('Chronological record'));
  if (doc.records.length === 0) {
    children.push(body('No records are included in this document.', { italics: true }));
  }
  doc.records.forEach(r => {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      spacing: { before: 320, after: 60 },
      children: [new TextRun({ text: r.heading, size: 28, bold: true, font: 'Arial', color: '1A1A1A' })],
    }));
    if (r.title) children.push(body(r.title, { italics: true, after: 60 }));
    children.push(body(`Sealed ${r.sealedLabel}`, { size: 17, color: '767676', after: 120 }));

    if (cfg.includeDetails && r.details.length) {
      r.details.forEach(d => children.push(body(`${d.label}: ${d.value}`, { size: 18, color: '5A5A5A', after: 40 })));
      children.push(body('', { after: 60 }));
    }

    children.push(body('Original record', { size: 17, bold: true, color: '767676', after: 60 }));
    r.text.split('\n').forEach(p => children.push(body(p, { after: 100 })));

    if (cfg.includeClarifications && r.clarifications.length) {
      children.push(body('Clarifications added later', { size: 17, bold: true, color: '767676', after: 60 }));
      r.clarifications.forEach(c => {
        children.push(body(c.label, { size: 17, color: '767676', indent: 360, after: 40 }));
        children.push(body(c.text, { size: 21, indent: 360, after: 120 }));
      });
    }

    if (r.evidence.length) {
      children.push(body('Evidence', { size: 17, bold: true, color: '767676', after: 60 }));
      r.evidence.forEach(e => {
        const img = e.type === 'image' ? images.get(e.id) : undefined;
        if (img) {
          const maxW = 420; // points, keeps images inside A4 margins
          const scale = Math.min(maxW / img.width, 320 / img.height, 1);
          try {
            children.push(new Paragraph({
              keepNext: true,
              indent: { left: 360 },
              spacing: { after: 60 },
              children: [new ImageRun({
                type: 'jpg',
                data: img.bytes,
                transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
                altText: { title: e.name, description: e.description ?? e.name, name: e.name },
              })],
            }));
          } catch {
            /* unembeddable image — the textual reference below still appears */
          }
        }
        const meta = [e.typeLabel, e.name, e.sizeLabel, e.durationLabel].filter(Boolean).join(' · ');
        children.push(body(meta, { size: 17, color: '6E6E6E', indent: 360, after: 40 }));
        if (e.description) children.push(body(e.description, { size: 20, indent: 360, after: 40 }));
        children.push(body(`${e.roleLabel} · added ${e.addedLabel}`, { size: 16, color: '8C8C8C', indent: 360, after: 120 }));
      });
      children.push(body('File contents have not been analysed or verified.', { size: 16, italics: true, color: '8C8C8C', indent: 360, after: 120 }));
    }
  });

  /* Appendices */
  if (cfg.includeClarifications && doc.hasClarifications) {
    children.push(new Paragraph({ children: [new PageBreak()] }), sectionHeading('Appendix A — Clarifications'));
    children.push(body('Every clarification in this document, listed with the record it belongs to.', { size: 19, color: '6E6E6E' }));
    doc.records.filter(r => r.clarifications.length).forEach(r => {
      children.push(body(r.heading, { bold: true, after: 60 }));
      r.clarifications.forEach(c => {
        children.push(body(c.label, { size: 17, color: '767676', indent: 360, after: 40 }));
        children.push(body(c.text, { size: 21, indent: 360, after: 160 }));
      });
    });
  }

  if (cfg.includeHistory && doc.records.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }), sectionHeading('Appendix B — Record history'));
    children.push(body('When each record was written, sealed and added to.', { size: 19, color: '6E6E6E' }));
    doc.records.forEach(r => {
      children.push(body(r.heading, { bold: true, after: 60 }));
      r.history.forEach(h => children.push(body(h, { size: 19, indent: 360, after: 40 })));
      children.push(body('', { after: 80 }));
    });
  }

  /* Integrity */
  children.push(new Paragraph({ children: [new PageBreak()] }), sectionHeading('How this document was assembled'));
  doc.integrity.forEach(p => children.push(body(p, { after: 160 })));

  const wordDocument = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22, color: '1A1A1A' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: '1A1A1A' },
          paragraph: { spacing: { before: 320, after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: '1A1A1A' },
          paragraph: { spacing: { before: 320, after: 60 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        titlePage: true, // cover page carries no running header
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 20mm
        },
      },
      headers: {
        first: new Header({ children: [new Paragraph({ children: [] })] }),
        default: new Header({
          children: [new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: doc.title, size: 16, color: '8C8C8C', font: 'Arial' })],
          })],
        }),
      },
      footers: {
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: `Generated ${doc.generatedLabel}`, size: 16, color: '8C8C8C', font: 'Arial' }),
              new TextRun({ text: '\tPage ', size: 16, color: '8C8C8C', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '8C8C8C', font: 'Arial' }),
              new TextRun({ text: ' of ', size: 16, color: '8C8C8C', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '8C8C8C', font: 'Arial' }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(wordDocument);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(doc.title)}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
