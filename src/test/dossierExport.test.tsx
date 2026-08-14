// Regression coverage for Chronicle delivery (Print / PDF / Word).
//
// These export paths previously appeared to "do nothing": generation succeeded
// but the browser silently dropped the anchor download and window.print().
// The tests below lock in that each button invokes its generator with the
// current report model, never submits or navigates, and that empty/filtered
// states are handled safely.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DossierAdapter, DossierSourceRecord } from '@/chronicle/shared/dossierModel';

const pdfSpy = vi.fn(async () => ({ status: 'downloaded' as const, url: 'blob:pdf', filename: 'r.pdf' }));
const docxSpy = vi.fn(async () => ({ status: 'downloaded' as const, url: 'blob:docx', filename: 'r.docx' }));

vi.mock('@/chronicle/dossier/exportPdf', () => ({ exportDossierPdf: (...a: unknown[]) => pdfSpy(...(a as [])) }));
vi.mock('@/chronicle/dossier/exportDocx', () => ({ exportDossierDocx: (...a: unknown[]) => docxSpy(...(a as [])) }));

import DossierView from '@/chronicle/shared/DossierView';
import AppSurface from '@/chronicle/shared/AppSurface';

const record = (id: string, included = true): DossierSourceRecord => ({
  id,
  title: 'Record ' + id,
  original_text: 'Original wording ' + id,
  sealed_at: `2026-01-0${id}T09:00:00.000Z`,
  captured_at: `2026-01-0${id}T09:00:00.000Z`,
  event_date: `2026-01-0${id}`,
  event_time: null,
  category: 'Bullying',
  context: 'Team meeting',
  people: ['Line manager'],
  clarifications: [],
  in_dossier: included,
});

const adapter = (records: DossierSourceRecord[]): DossierAdapter => ({
  records,
  media: [],
  loading: false,
  setIncluded: async () => {},
  loadBlob: async () => null,
  useMediaUrl: () => null,
});

const renderView = (records = [record('1'), record('2')], withheld: string | null = null) =>
  render(
    <MemoryRouter>
      <AppSurface>
        <DossierView adapter={adapter(records)} previewWithheld={withheld} />
      </AppSurface>
    </MemoryRouter>,
  );

const click = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

const openPreview = async () => {
  await click('Preview report');
};

describe('Chronicle export delivery', () => {
  beforeEach(() => {
    pdfSpy.mockClear();
    docxSpy.mockClear();
  });

  it('PDF button generates with the current report model', async () => {
    renderView();
    await openPreview();
    await click(/Export PDF report/);
    await waitFor(() => expect(pdfSpy).toHaveBeenCalledTimes(1));
    const [doc, cfg] = pdfSpy.mock.calls[0] as unknown as [{ records: unknown[] }, unknown];
    expect(doc.records.length).toBe(2);
    expect(cfg).toBeTruthy();
    expect(docxSpy).not.toHaveBeenCalled();
  });

  it('Word button generates a DOCX from the same model', async () => {
    renderView();
    await openPreview();
    await click(/Export Word report/);
    await waitFor(() => expect(docxSpy).toHaveBeenCalledTimes(1));
    const [doc] = docxSpy.mock.calls[0] as unknown as [{ records: unknown[] }];
    expect(doc.records.length).toBe(2);
  });

  it('Print invokes the print path against the rendered report', async () => {
    const printSpy = vi.fn();
    // Printing happens in a cloned iframe; stub its window print.
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'iframe') {
        Object.defineProperty(el, 'contentWindow', {
          get: () => ({ focus: () => {}, print: printSpy, close: () => {} }),
        });
      }
      return el;
    }) as typeof document.createElement);

    renderView();
    await openPreview();
    expect(document.getElementById('proto-doc')).toBeTruthy();
    await click('Print');
    await waitFor(() => expect(printSpy).toHaveBeenCalled(), { timeout: 2000 });
    vi.restoreAllMocks();
  });

  it('export buttons are plain buttons that cannot submit a form', async () => {
    renderView();
    await openPreview();
    ['Export PDF report', 'Export Word report', 'Print'].forEach(name => {
      const btn = screen.getByRole('button', { name: new RegExp(name) }) as HTMLButtonElement;
      expect(btn.type).toBe('button');
    });
  });

  it('disables export when nothing is included, and never generates', async () => {
    renderView([record('1', false)]);
    await openPreview();
    const btn = screen.getByRole('button', { name: /Export PDF report/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await act(async () => { fireEvent.click(btn); });
    expect(pdfSpy).not.toHaveBeenCalled();
  });
});
