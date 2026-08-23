import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChronicleMark from './ChronicleMark';
import ChronicleLockup from './ChronicleLockup';
import ChronicleEmptyState from './ChronicleEmptyState';
import ChroniclePageHeader from './ChroniclePageHeader';
import { CHRONICLE_MARK, CHRONICLE_MARK_VIEWBOX } from './markGeometry';

describe('Chronicle brand', () => {
  it('keeps the Bound Record geometry stable', () => {
    expect(CHRONICLE_MARK_VIEWBOX).toBe('0 0 64 64');
    expect(CHRONICLE_MARK.nodes).toEqual([19.5, 32, 44.5]);
    expect(CHRONICLE_MARK.page).toContain('54 18');
  });

  it('renders a decorative mark without exposing duplicate accessible text', () => {
    const { container } = render(<ChronicleMark />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', CHRONICLE_MARK_VIEWBOX);
  });

  it('can expose the mark as an accessible image when labelled', () => {
    render(<ChronicleMark label="Chronicle" />);
    expect(screen.getByRole('img', { name: 'Chronicle' })).toBeInTheDocument();
  });

  it('renders the lockup and optional descriptor', () => {
    render(<ChronicleLockup subtitle="The bound record" />);
    expect(screen.getByText('Chronicle')).toBeInTheDocument();
    expect(screen.getByText('The bound record')).toBeInTheDocument();
  });

  it('anchors signed-in pages with a Chronicle masthead', () => {
    const { container } = render(<ChroniclePageHeader title="Notebook" subtitle="Every record, in order" />);
    expect(screen.getByRole('heading', { name: 'Notebook' })).toBeInTheDocument();
    expect(screen.getByText('Chronicle')).toBeInTheDocument();
    expect(container.querySelector('.proto-brandhead-stamp')).toBeInTheDocument();
  });

  it('renders branded empty-state content as status by default', () => {
    render(<ChronicleEmptyState>No records yet</ChronicleEmptyState>);
    expect(screen.getByRole('status')).toHaveTextContent('No records yet');
  });
});
