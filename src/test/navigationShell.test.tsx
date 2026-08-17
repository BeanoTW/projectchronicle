// Navigation shell regression coverage.
//
// One navigation model (navModel.tsx) with three presentations: drawer (mobile),
// compact rail (tablet), full rail (desktop) — plus one persistent Capture action.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppDrawer from '@/components/chronicle/AppDrawer';
import CaptureFab from '@/components/chronicle/CaptureFab';
import AppSideNav from '@/components/chronicle/AppSideNav';
import { destinations, isDestinationActive, captureAction } from '@/components/chronicle/navModel';

const signOut = vi.fn();

vi.mock('@/contexts/PrivacyContext', () => ({ usePrivacy: () => ({ enabled: false }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com' }, signOut }),
}));

const Probe = () => {
  const { pathname } = useLocation();
  return <p data-testid="path">{pathname}</p>;
};

const renderShell = (initial = '/home') =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <AppDrawer />
      <Probe />
      <CaptureFab />
      <Routes>
        <Route path="*" element={<p>screen</p>} />
      </Routes>
    </MemoryRouter>,
  );

const openDrawer = async () => {
  fireEvent.click(screen.getByTestId('nav-menu-button'));
  await waitFor(() => expect(screen.getByTestId('nav-drawer')).toBeTruthy());
};

beforeEach(() => { signOut.mockClear(); });

describe('navigation model', () => {
  it('exposes exactly the agreed destinations, once', () => {
    expect(destinations.map(d => d.label)).toEqual([
      'Home', 'Notebook', 'Chronicle', 'Attachments', 'Settings', 'Support',
    ]);
    expect(destinations.filter(d => d.path === captureAction.path)).toHaveLength(0);
  });

  it('marks deep-linked record and evidence routes against their destination', () => {
    const notebook = destinations.find(d => d.label === 'Notebook')!;
    const attachments = destinations.find(d => d.label === 'Attachments')!;
    const chronicle = destinations.find(d => d.label === 'Chronicle')!;
    expect(isDestinationActive(notebook, '/incident/abc')).toBe(true);
    expect(isDestinationActive(attachments, '/evidence')).toBe(true);
    expect(isDestinationActive(chronicle, '/my-record')).toBe(true);
    expect(isDestinationActive(notebook, '/settings')).toBe(false);
  });
});

describe('mobile drawer', () => {
  it('opens from the top-left menu control and closes on Escape', async () => {
    renderShell();
    expect(screen.queryByTestId('nav-drawer')).toBeNull();
    await openDrawer();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('nav-drawer')).toBeNull());
  });

  it('closes with the explicit close control', async () => {
    renderShell();
    await openDrawer();
    fireEvent.click(screen.getByLabelText('Close navigation menu'));
    await waitFor(() => expect(screen.queryByTestId('nav-drawer')).toBeNull());
  });

  it.each(destinations.map(d => [d.label, d.path]))(
    'navigates to %s and closes afterwards', async (label, path) => {
      renderShell('/home');
      await openDrawer();
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe(path));
      await waitFor(() => expect(screen.queryByTestId('nav-drawer')).toBeNull());
    });

  it('indicates the current destination', async () => {
    renderShell('/timeline');
    await openDrawer();
    const current = screen.getByRole('button', { name: /^Notebook/ });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: /^Home/ }).getAttribute('aria-current')).toBeNull();
  });

  it('is a modal dialog with an accessible name and traps focus', async () => {
    renderShell();
    await openDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label') || dialog.textContent).toBeTruthy();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('shows the signed-in identity and signs out', async () => {
    renderShell();
    await openDrawer();
    expect(screen.getByTestId('drawer-account').textContent).toContain('tester@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('never pushes history entries of its own', async () => {
    renderShell('/home');
    await openDrawer();
    expect(screen.getByTestId('path').textContent).toBe('/home');
  });
});

describe('persistent Capture action', () => {
  it.each(['/home', '/timeline', '/export', '/attachments', '/settings', '/support', '/incident/abc'])(
    'is available on %s', path => {
      renderShell(path);
      expect(screen.getByTestId('capture-fab')).toBeTruthy();
    });

  it('opens the canonical capture route and then steps aside', async () => {
    renderShell('/home');
    fireEvent.click(screen.getByTestId('capture-fab'));
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/record'));
    expect(screen.queryByTestId('capture-fab')).toBeNull();
  });

  it('has an accessible label and a comfortable touch target', () => {
    renderShell('/home');
    const fab = screen.getByTestId('capture-fab');
    expect(fab.getAttribute('aria-label')).toBe('Capture a new record');
    const css = readFileSync(join(process.cwd(), 'src/chronicle/styles.css'), 'utf8');
    const block = css.slice(css.indexOf('.proto-root .proto-fab-capture {'));
    expect(block.slice(0, block.indexOf('}'))).toMatch(/min-height: 5\dpx/);
  });

  it('reserves only its own safe-area clearance beneath the page', () => {
    renderShell('/home');
    expect(screen.getByTestId('capture-fab-wrap').getAttribute('data-hidden')).toBe('false');
    const css = readFileSync(join(process.cwd(), 'src/chronicle/styles.css'), 'utf8');
    expect(css).toMatch(/\.proto-root \.proto-fabwrap\[data-hidden="true"\] \.proto-fab-spacer/);
  });
});

describe('desktop / tablet rail', () => {
  it('renders every destination, Capture and the account block', () => {
    render(<MemoryRouter initialEntries={['/export']}><AppSideNav /></MemoryRouter>);
    destinations.forEach(d => expect(screen.getAllByText(d.label).length).toBeGreaterThan(0));
    expect(screen.getByText('New record')).toBeTruthy();
    expect(screen.getByTestId('rail-account').textContent).toContain('tester@example.com');
  });

  it('marks the active destination, including deep-linked records', () => {
    render(<MemoryRouter initialEntries={['/incident/abc']}><AppSideNav /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /^Notebook/ }).getAttribute('aria-current')).toBe('page');
  });

  it('signs out from the rail', () => {
    render(<MemoryRouter initialEntries={['/home']}><AppSideNav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe('reduced motion and safe areas', () => {
  const css = readFileSync(join(process.cwd(), 'src/chronicle/styles.css'), 'utf8');
  it('drawer animation is disabled under prefers-reduced-motion', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.proto-root\.proto-drawer/);
  });
  it('the app bar, drawer and Capture action respect safe-area insets', () => {
    expect(css).toMatch(/\.proto-root \.proto-appbar \{[\s\S]*?safe-area-inset-top/);
    expect(css).toMatch(/\.proto-root\.proto-drawer \{[\s\S]*?safe-area-inset-bottom/);
    expect(css).toMatch(/\.proto-root \.proto-fab-capture \{[\s\S]*?safe-area-inset-bottom/);
  });
});
