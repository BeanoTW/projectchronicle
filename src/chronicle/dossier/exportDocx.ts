// Chronicle V2 (candidate). Word export. Mirrors the on-screen preview and the PDF.
//
// Georgia for headings (installed with Word, Google Docs and LibreOffice),
// Arial for text. The Chronicle spine appears as a paragraph border: green
// beside original sealed wording, grey beside clarifications added later.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Header, Footer, PageNumber, PageBreak, BorderStyle, TabStopType, TabStopPosition, ImageRun, LineRuleType,
} from 'docx';
import type { DossierConfig, DossierDocumentModel } from '../shared/dossierModel';
import { safeFileName } from '../shared/dossierModel';
import { prepareEvidenceImages, type LoadBlob } from './evidenceImages';
import { deliverBlob, type Delivery } from './deliver';

const INK = '111821';
const INK_2 = '3A4551';
const MUTED = '5F6B77';
const LINE = 'DDE3E8';
const ACCENT = '1F6A53';
const SPINE_SOFT = 'C3CCD4';
const DISPLAY = 'Georgia';
const TEXT = 'Arial';

type Spine = 'original' | 'added' | undefined;

const spineBorder = (spine: Spine) =>
  spine
    ? {
        left: {
          style: BorderStyle.SINGLE,
          size: spine === 'original' ? 18 : 10,
          color: spine === 'original' ? ACCENT : SPINE_SOFT,
          space: 10,
        },
      }
    : undefined;

const body = (
  text: string,
  opts: Partial<{
    size: number; bold: boolean; italics: boolean; color: string; indent: number; after: number;
    font: string; spine: Spine; keepNext: boolean;
  }> = {},
) =>
  new Paragraph({
    indent: opts.indent || opts.spine ? { left: (opts.indent ?? 0) + (opts.spine ? 220 : 0) } : undefined,
    spacing: { after: opts.after ?? 120, line: 300, lineRule: LineRuleType.AUTO },
    keepNext: opts.keepNext,
    border: spineBorder(opts.spine),
    children: [new TextRun({
      text,
      size: opts.size ?? 22,
      bold: opts.bold,
      italics: opts.italics,
      color: opts.color ?? INK,
      font: opts.font ?? TEXT,
    })],
  });

const label = (text: string, color = MUTED, spine?: Spine, indent = 0) =>
  body(text, { size: 16, bold: true, color, after: 60, spine, indent, keepNext: true });

const sectionHeading = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 120, after: 280 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 8 } },
    children: [new TextRun({ text, size: 40, font: DISPLAY, color: INK })],
  });

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

export async function exportDossierDocx(
  doc: DossierDocumentModel,
  cfg: DossierConfig,
  loadBlob?: LoadBlob,
  onProgress?: (done: number, total: number) => void,
): Promise<Delivery> {
  const children: Paragraph[] = [];
  const images = await prepareEvidenceImages(doc, loadBlob, onProgress);

  /* Cover */
  children.push(
    new Paragraph({
      spacing: { before: 240, after: 20 },
      children: [
        new TextRun({ text: '● ', size: 26, color: ACCENT, font: TEXT }),
        new TextRun({ text: 'Chronicle', size: 34, color: INK, font: DISPLAY }),
      ],
    }),
    new Paragraph({
      spacing: { after: 2400 },
      children: [new TextRun({ text: 'A chronological record', size: 17, color: MUTED, font: TEXT })],
    }),
    new Paragraph({
      spacing: { after: 200, line: 250, lineRule: LineRuleType.AUTO },
      alignment: AlignmentType.LEFT,
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: ACCENT, space: 14 } },
      indent: { left: 280 },
      children: [new TextRun({ text: doc.title, size: 68, font: DISPLAY, color: INK })],
    }),
    body(doc.rangeLabel, { size: 25, color: INK_2, after: 600 }),
    new Paragraph({
      spacing: { after: 2600 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 },
      },
      children: [
        new TextRun({ text: `${doc.records.length} record${doc.records.length === 1 ? '' : 's'}`, size: 22, color: INK, font: TEXT }),
        new TextRun({ text: `   ·   ${doc.people.length} ${doc.people.length === 1 ? 'person' : 'people'} named`, size: 22, color: INK_2, font: TEXT }),
        new TextRun({ text: `   ·   Generated ${doc.generatedLabel}`, size: 22, color: INK_2, font: TEXT }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      border: { top: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 10 } },
      children: [new TextRun({ text: 'Original wording preserved. Clarifications shown separately.', size: 19, color: INK_2, font: TEXT })],
    }),
    body(`Generated ${doc.generatedLabel}`, { size: 17, color: MUTED }),
    pageBreak(),
  );

  /* Contents */
  children.push(sectionHeading('Contents'));
  doc.contents.forEach(c =>
    children.push(
      c.kind === 'record'
        ? body(c.label, { size: 20, color: INK_2, indent: 360, after: 60 })
        : body(c.label, { size: 21, bold: true, after: 80 }),
    ),
  );
  children.push(pageBreak());

  /* Overview */
  children.push(sectionHeading('Overview'));
  ([
    ['Date range', doc.rangeLabel],
    ['Records included', String(doc.records.length)],
    ['People named', doc.people.length ? doc.people.join(', ') : 'None recorded'],
    ['Categories', doc.categories.length ? doc.categories.join(', ') : 'None recorded'],
  ] as Array<[string, string]>).forEach(([k, v]) => {
    children.push(body(k, { size: 17, color: MUTED, after: 30, keepNext: true }));
    children.push(new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
      children: [new TextRun({ text: v, size: 22, color: INK, font: TEXT })],
    }));
  });
  children.push(pageBreak());

  /* Chronological record */
  children.push(sectionHeading('Chronological record'));
  if (doc.records.length === 0) {
    children.push(body('No records are included in this document.', { italics: true }));
  }
  doc.records.forEach(r => {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      spacing: { before: 440, after: 60 },
      children: [
        new TextRun({ text: '● ', size: 22, color: ACCENT, font: TEXT }),
        new TextRun({ text: r.heading, size: 32, font: DISPLAY, color: INK }),
      ],
    }));
    if (r.title) children.push(body(r.title, { bold: true, after: 40, keepNext: true }));
    children.push(body(`Sealed ${r.sealedLabel}`, { size: 17, color: MUTED, after: 140, keepNext: true }));

    if (cfg.includeDetails && r.details.length) {
      r.details.forEach(d => children.push(new Paragraph({
        spacing: { after: 30 },
        keepNext: true,
        tabStops: [{ type: TabStopType.LEFT, position: 1800 }],
        children: [
          new TextRun({ text: d.label, size: 17, color: MUTED, font: TEXT }),
          new TextRun({ text: `\t${d.value}`, size: 18, color: INK_2, font: TEXT }),
        ],
      })));
      children.push(body('', { after: 80 }));
    }

    children.push(label('Original record', ACCENT, 'original'));
    r.text.split('\n').forEach(p => children.push(body(p, { after: 100, spine: 'original' })));

    if (cfg.includeClarifications && r.clarifications.length) {
      children.push(body('', { after: 40 }));
      children.push(label('Clarifications added later', MUTED, 'added'));
      r.clarifications.forEach(c => {
        children.push(body(c.label, { size: 17, color: MUTED, after: 40, spine: 'added', keepNext: true }));
        children.push(body(c.text, { size: 21, color: INK_2, after: 120, spine: 'added' }));
      });
    }

    if (r.evidence.length) {
      children.push(body('', { after: 40 }));
      children.push(label('Evidence'));
      r.evidence.forEach(e => {
        const img = e.type === 'image' ? images.get(e.id) : undefined;
        if (img) {
          const maxW = 420;
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
        children.push(body(meta, { size: 17, color: INK_2, indent: 360, after: 40 }));
        if (e.description) children.push(body(e.description, { size: 20, indent: 360, after: 40 }));
        children.push(body(`${e.roleLabel} · added ${e.addedLabel}`, { size: 16, color: MUTED, indent: 360, after: 120 }));
      });
      children.push(body('File contents have not been analysed or verified.', { size: 16, italics: true, color: MUTED, indent: 360, after: 120 }));
    }

    children.push(new Paragraph({
      spacing: { before: 120, after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
      children: [],
    }));
  });

  /* Appendices */
  if (cfg.includeClarifications && doc.hasClarifications) {
    children.push(pageBreak(), sectionHeading('Appendix A — Clarifications'));
    children.push(body('Every clarification in this document, listed with the record it belongs to.', { size: 19, color: MUTED, after: 200 }));
    doc.records.filter(r => r.clarifications.length).forEach(r => {
      children.push(body(r.heading, { size: 26, font: DISPLAY, after: 60, keepNext: true }));
      r.clarifications.forEach(c => {
        children.push(body(c.label, { size: 17, color: MUTED, indent: 360, after: 40, keepNext: true }));
        children.push(body(c.text, { size: 21, indent: 360, after: 160 }));
      });
    });
  }

  if (cfg.includeHistory && doc.records.length > 0) {
    children.push(pageBreak(), sectionHeading('Appendix B — Record history'));
    children.push(body('When each record was written, sealed and added to.', { size: 19, color: MUTED, after: 200 }));
    doc.records.forEach(r => {
      children.push(body(r.heading, { size: 26, font: DISPLAY, after: 60, keepNext: true }));
      r.history.forEach(h => children.push(body(h, { size: 19, color: INK_2, indent: 360, after: 40 })));
      children.push(body('', { after: 80 }));
    });
  }

  /* Integrity */
  children.push(pageBreak(), sectionHeading('How this document was assembled'));
  doc.integrity.forEach((p, i) => children.push(new Paragraph({
    spacing: { after: 160, line: 300, lineRule: LineRuleType.AUTO },
    indent: { left: 440, hanging: 440 },
    tabStops: [{ type: TabStopType.LEFT, position: 440 }],
    children: [
      new TextRun({ text: `${i + 1}`, size: 24, color: ACCENT, font: DISPLAY }),
      new TextRun({ text: `\t${p}`, size: 21, color: INK, font: TEXT }),
    ],
  })));

  const running = { size: 16, color: MUTED, font: TEXT };
  const wordDocument = new Document({
    styles: {
      default: { document: { run: { font: TEXT, size: 22, color: INK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 40, font: DISPLAY, color: INK },
          paragraph: { spacing: { before: 120, after: 280 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, font: DISPLAY, color: INK },
          paragraph: { spacing: { before: 440, after: 60 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        titlePage: true,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      headers: {
        first: new Header({ children: [new Paragraph({ children: [] })] }),
        default: new Header({
          children: [new Paragraph({
            spacing: { after: 200 },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
            children: [
              new TextRun({ text: '● ', ...running, color: ACCENT }),
              new TextRun({ text: `Chronicle · ${doc.title}`, ...running }),
              new TextRun({ text: `\t${doc.rangeLabel}`, ...running }),
            ],
          })],
        }),
      },
      footers: {
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
            children: [
              new TextRun({ text: `Generated ${doc.generatedLabel}`, ...running }),
              new TextRun({ text: '\tPage ', ...running }),
              new TextRun({ children: [PageNumber.CURRENT], ...running }),
              new TextRun({ text: ' of ', ...running }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], ...running }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(wordDocument);
  return deliverBlob(blob, `${safeFileName(doc.title)}.docx`);
}