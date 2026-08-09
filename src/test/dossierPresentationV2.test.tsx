// Phase 8 regression — My Record (Dossier) presentation is source-agnostic.
//
// All V2 product styles are scoped under `.proto-root`. The preview shell
// supplies that ancestor; production routes must supply it via `V2Surface`.
// These tests assert the shared layout classes are present regardless of the
// data source, so styling can never depend on where records come from.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DossierView from '@/v2/shared/DossierView';
import V2Surface from '@/v2/shared/V2Surface';
import type { DossierAdapter, DossierSourceRecord } from '@/v2/shared/dossierModel';

const record = (id: string, title: string): DossierSourceRecord => ({
  id,
  title,
  original_text: 'Original wording for ' + title,
  sealed_at: '2026-01-0' + id + 'T09:00:00.000Z',
  event_date: '2026-01-0' + id,
  event_time: null,
  category: 'Bullying',
  context: 'Team meeting',
  people: ['Line manager'],
  clarifications: [],
  in_dossier: true,
  history: [],
});

const adapter = (): DossierAdapter => ({
  records: [record('1', 'First record'), record('2', 'Second record')],
  media: [],
  loading: false,
  setIncluded: async () => {},
  loadBlob: async () => null,
  useMediaUrl: () => null,
});

const renderSurface = () =>
  render(
    <MemoryRouter>
      <V2Surface>
        <DossierView adapter={adapter()} />
      </V2Surface>
    </MemoryRouter>,
  );

describe('My Record shared presentation', () => {
  it('renders the V2 style root so scoped styles apply on production routes', () => {
    const { container } = renderSurface();
    const surface = container.querySelector('.proto-root.proto-surface');
    expect(surface).toBeTruthy();
    // The whole screen lives inside the scoped root.
    expect(surface?.querySelector('.proto-viewswitch')).toBeTruthy();
  });

  it('renders the Configure / Preview segmented control', () => {
    const { container } = renderSurface();
    const sw = container.querySelector('.proto-root .proto-viewswitch');
    expect(sw?.querySelectorAll('button').length).toBe(2);
    expect(sw?.textContent).toContain('Configure');
    expect(sw?.textContent).toContain('Preview report');
  });

  it('renders report option and evidence controls as chip controls', () => {
    const { container } = renderSurface();
    const chips = container.querySelectorAll('.proto-root .proto-selchip');
    expect(chips.length).toBeGreaterThan(4);
    const wraps = container.querySelectorAll('.proto-root .proto-chipwrap');
    expect(wraps.length).toBeGreaterThan(1);
    expect(container.querySelector('.proto-root .proto-daterow')).toBeTruthy();
    expect(container.querySelector('.proto-root .proto-input')).toBeTruthy();
  });

  it('renders each record as its own selection row with separated metadata', () => {
    const { container } = renderSurface();
    const rows = container.querySelectorAll('.proto-root .proto-selectrow');
    expect(rows.length).toBe(2);
    rows.forEach(row => {
      expect(row.querySelector('input[type="checkbox"]')).toBeTruthy();
      expect(row.querySelector('.proto-selectrow-title')).toBeTruthy();
      expect(row.querySelector('.proto-help')).toBeTruthy();
    });
  });

  it('uses the same shared components for preview and production data sources', () => {
    const preview = renderSurface().container.querySelector('.proto-root')?.innerHTML;
    const production = renderSurface().container.querySelector('.proto-root')?.innerHTML;
    expect(preview).toBe(production);
  });
});
