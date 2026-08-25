import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterSheet from '@/chronicle/components/FilterSheet';
import DossierConfigureView from '@/chronicle/shared/DossierConfigureView';
import { emptyFilters } from '@/chronicle/filters';
import { defaultDossierConfig } from '@/chronicle/shared/dossierModel';

describe('release-readiness accessibility', () => {
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
});
