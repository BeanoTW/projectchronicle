import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterSheet from '@/chronicle/components/FilterSheet';
import DossierConfigureView from '@/chronicle/shared/DossierConfigureView';
import DossierView from '@/chronicle/shared/DossierView';
import { emptyFilters } from '@/chronicle/filters';
import { defaultDossierConfig, type DossierAdapter } from '@/chronicle/shared/dossierModel';

describe('release-readiness accessibility and integrity', () => {
  it('exposes filter selection state and a named modal dialog', () => {
    render(<FilterSheet open value={{ ...emptyFilters, categories: ['Work'] }} categories={['Work']} people={[]} onClose={vi.fn()} onApply={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('exposes report option state to assistive technology', () => {
    const cfg = { ...defaultDossierConfig, order: 'desc' as const, includeClarifications: true };
    render(<DossierConfigureView cfg={cfg} onChange={vi.fn()} rows={[]} totalRecords={0} categories={[]} people={[]} onToggleMember={vi.fn()} totalMembers={0} hiddenByFilters={0} includedInDocument={0} />);
    expect(screen.getByRole('button', { name: 'Newest first' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Clarifications' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Report title' })).toBeInTheDocument();
  });
  it('never presents a sealing timestamp as an event date in Configure', () => {
    const adapter: DossierAdapter = { loading: false, records: [{ id: 'legacy', title: 'Legacy record', original_text: 'Original wording', sealed_at: '2026-03-08T10:00:00.000Z', captured_at: '2026-03-08T09:00:00.000Z', event_date: null, event_time: null, category: null, context: null, people: [], clarifications: [], in_dossier: true }], media: [], setIncluded: vi.fn(async () => undefined), loadBlob: vi.fn(async () => null), useMediaUrl: () => null };
    render(<DossierView adapter={adapter} />);
    expect(screen.getByText(/Date not recorded/)).toBeInTheDocument();
    expect(screen.queryByText(/8 Mar 2026/)).not.toBeInTheDocument();
  });
});
