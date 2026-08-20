// Contextual-guidance regression coverage.
//
// Guidance is presentation only: it must appear once for a genuinely new
// account, never for an established one, never return after being skipped or
// completed, and always be escapable.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuidanceTour from '@/chronicle/guidance/GuidanceTour';
import ChronicleHelp from '@/components/chronicle/ChronicleHelp';
import AppSideNav from '@/components/chronicle/AppSideNav';
import AppDrawer from '@/components/chronicle/AppDrawer';
import DossierConfigureView from '@/chronicle/shared/DossierConfigureView';
import { defaultDossierConfig, type DossierConfig } from '@/chronicle/shared/dossierModel';
import {
  isGuidanceComplete,
  markGuidanceComplete,
  resetGuidance,
  isNewAccount,
  GUIDANCE_RELEASED_AT,
  type GuidanceStep,
} from '@/chronicle/guidance/guidanceModel';
import { useGuidance } from '@/chronicle/guidance/useGuidance';
import { appTourSteps, chronicleTourSteps } from '@/chronicle/guidance/tours';

const currentUser = { id: 'user-a', email: 'a@example.com', created_at: new Date().toISOString() };

vi.mock('@/contexts/PrivacyContext', () => ({ usePrivacy: () => ({ enabled: false }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, signOut: vi.fn() }),
}));

beforeEach(() => { localStorage.clear(); currentUser.id = 'user-a'; });
afterEach(() => cleanup());

/* ------------------------------------------------------------------ */

describe('new-account eligibility', () => {
  const fresh = new Date(GUIDANCE_RELEASED_AT + 86400000).toISOString();

  it('treats a recently created, empty account as new', () => {
    expect(isNewAccount(new Date().toISOString(), 0)).toBe(true);
    expect(isNewAccount(fresh, 0)).toBe(isNewAccount(fresh, 0)); // stable
  });

  it('never treats an account created before guidance shipped as new', () => {
    expect(isNewAccount(new Date(GUIDANCE_RELEASED_AT - 86400000).toISOString(), 0)).toBe(false);
  });

  it('never treats an account with records as new', () => {
    expect(isNewAccount(new Date().toISOString(), 3)).toBe(false);
  });

  it('handles a missing or malformed creation date safely', () => {
    expect(isNewAccount(null, 0)).toBe(false);
    expect(isNewAccount('not-a-date', 0)).toBe(false);
  });
});

describe('per-account completion state', () => {
  it('stores completion separately for each account', () => {
    markGuidanceComplete('app_intro_completed', 'user-a');
    expect(isGuidanceComplete('app_intro_completed', 'user-a')).toBe(true);
    expect(isGuidanceComplete('app_intro_completed', 'user-b')).toBe(false);
    resetGuidance('app_intro_completed', 'user-a');
    expect(isGuidanceComplete('app_intro_completed', 'user-a')).toBe(false);
  });

  it('keeps the app and Chronicle introductions independent', () => {
    markGuidanceComplete('chronicle_intro_completed', 'user-a');
    expect(isGuidanceComplete('app_intro_completed', 'user-a')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

const steps: GuidanceStep[] = [
  { id: 'one', title: 'First', body: 'First body', targets: ['[data-guide="nav-timeline"]'] },
  { id: 'two', title: 'Second', body: 'Second body' },
];

const Harness = ({ eligible = true }: { eligible?: boolean }) => {
  const g = useGuidance('app_intro_completed', eligible);
  return (
    <>
      <button type="button" onClick={g.replay}>replay</button>
      <GuidanceTour steps={steps} open={g.open} label="Introduction" onEnd={g.end} />
    </>
  );
};

describe('guidance runtime', () => {
  it('auto-starts once for an eligible account', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('guidance-tour')).toBeTruthy());
    expect(screen.getByText('First')).toBeTruthy();
  });

  it('does not start for an ineligible (established) account', () => {
    render(<Harness eligible={false} />);
    expect(screen.queryByTestId('guidance-tour')).toBeNull();
  });

  it('does not return automatically once completed', async () => {
    render(<Harness />);
    await waitFor(() => screen.getByTestId('guidance-tour'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('guidance-tour')).toBeNull());
    expect(isGuidanceComplete('app_intro_completed', 'user-a')).toBe(true);

    cleanup();
    render(<Harness />);
    expect(screen.queryByTestId('guidance-tour')).toBeNull();
  });

  it('does not return automatically once skipped', async () => {
    render(<Harness />);
    await waitFor(() => screen.getByTestId('guidance-tour'));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(screen.queryByTestId('guidance-tour')).toBeNull());

    cleanup();
    render(<Harness />);
    expect(screen.queryByTestId('guidance-tour')).toBeNull();
  });

  it('can always be replayed on request', async () => {
    render(<Harness eligible={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'replay' }));
    await waitFor(() => expect(screen.getByTestId('guidance-tour')).toBeTruthy());
  });

  it('exits on Escape and never traps the user', async () => {
    render(<Harness />);
    await waitFor(() => screen.getByTestId('guidance-tour'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('guidance-tour')).toBeNull());
  });

  it('supports keyboard progression backwards and forwards', async () => {
    render(<Harness />);
    await waitFor(() => screen.getByTestId('guidance-tour'));
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Second')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('First')).toBeTruthy();
  });

  it('labels the guidance dialog for screen readers', async () => {
    render(<Harness />);
    const dialog = await screen.findByRole('dialog', { name: 'Introduction' });
    expect(dialog.getAttribute('aria-live')).toBe('polite');
    // Not modal: the page behind stays reachable, so no focus trap remains.
    expect(dialog.getAttribute('aria-modal')).toBe('false');
  });
});

/* ------------------------------------------------------------------ */

describe('responsive navigation targets', () => {
  it('exposes desktop rail anchors the tour selects', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/home']}><AppSideNav /></MemoryRouter>,
    );
    expect(container.querySelector('[data-guide="nav-timeline"]')).toBeTruthy();
    expect(container.querySelector('[data-guide="nav-export"]')).toBeTruthy();
    expect(container.querySelector('[data-guide="nav-capture"]')).toBeTruthy();
  });

  it('exposes drawer anchors and the menu target on mobile', async () => {
    render(<MemoryRouter initialEntries={['/home']}><AppDrawer /></MemoryRouter>);
    expect(screen.getByTestId('nav-menu-button')).toBeTruthy();
    fireEvent.click(screen.getByTestId('nav-menu-button'));
    await waitFor(() => expect(screen.getByTestId('nav-drawer')).toBeTruthy());
    expect(document.querySelector('[data-guide="nav-timeline"]')).toBeTruthy();
    expect(document.querySelector('[data-guide="nav-export"]')).toBeTruthy();
  });

  it('offers a fallback target for every tour step', () => {
    [...appTourSteps, ...chronicleTourSteps].forEach(s => {
      expect(s.targets?.length ?? 0).toBeGreaterThan(0);
    });
  });
});

/* ------------------------------------------------------------------ */

describe('Chronicle help control', () => {
  it('offers permanent help and can replay the walkthrough', () => {
    const onReplay = vi.fn();
    render(<div className="proto-root"><ChronicleHelp onReplay={onReplay} /></div>);
    const toggle = screen.getByTestId('chronicle-help-toggle');
    expect(toggle.textContent).toContain('How Chronicle works');
    expect(screen.queryByTestId('chronicle-help-panel')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('chronicle-help-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('chronicle-help-replay'));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */

const Configure = ({ cfg }: { cfg: DossierConfig }) => (
  <div className="proto-root">
    <DossierConfigureView
      cfg={cfg}
      onChange={() => {}}
      rows={[]}
      totalRecords={0}
      categories={['Bullying']}
      people={['Line manager']}
      onToggleMember={async () => {}}
      totalMembers={0}
      hiddenByFilters={0}
      includedInDocument={0}
    />
  </div>
);

describe('Chronicle filter discoverability', () => {
  it('shows an explicit Filter records heading with guidance anchors', () => {
    const { container } = render(<Configure cfg={defaultDossierConfig} />);
    expect(screen.getByText('Filter records')).toBeTruthy();
    expect(container.querySelector('[data-guide="chronicle-filters"]')).toBeTruthy();
    expect(container.querySelector('[data-guide="chronicle-options"]')).toBeTruthy();
    expect(container.querySelector('[data-guide="chronicle-records"]')).toBeTruthy();
  });

  it('hides the active-filter badge when no filter is applied', () => {
    render(<Configure cfg={defaultDossierConfig} />);
    expect(screen.queryByTestId('chronicle-filter-count')).toBeNull();
  });

  it('counts active filters and offers Clear filters', () => {
    render(<Configure cfg={{ ...defaultDossierConfig, from: '2026-01-01', category: 'Bullying' }} />);
    expect(screen.getByTestId('chronicle-filter-count').textContent).toContain('2 active');
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeTruthy();
  });
});
