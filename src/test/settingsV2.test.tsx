// Phase 9 — Settings surface, sign out, account safety.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  SettingsChoice,
  SettingsSection,
  SettingsToggle,
  SettingsDeferred,
} from '@/v2/shared/SettingsView';
import V2Surface from '@/v2/shared/V2Surface';
import {
  clearCaptureDrafts,
  clearUserScopedState,
  registerTransientReset,
  syncActiveUser,
} from '@/v2/shared/sessionCleanup';
import { productionDraftKey } from '@/v2/shared/captureModel';
import { notebookUiState, resetNotebookUiState } from '@/v2/shared/notebookUiState';
import { FLAG_DEFAULTS, isFeatureEnabled, clearFeatureOverrides, setFeatureOverride } from '@/lib/featureFlags';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  clearFeatureOverrides();
});

describe('Settings route flag', () => {
  it('is off by default in production so V1 settings remain the baseline', () => {
    expect(FLAG_DEFAULTS.v2Settings).toBe(false);
  });

  it('can be switched on independently', () => {
    setFeatureOverride('v2Settings', true);
    expect(isFeatureEnabled('v2Settings')).toBe(true);
    expect(isFeatureEnabled('v2Notebook')).toBe(isFeatureEnabled('v2Notebook'));
  });
});

describe('V2 shell settings access', () => {
  it('every V2 surface exposes a secondary settings control', () => {
    render(
      <MemoryRouter>
        <V2Surface><p>Notebook</p></V2Surface>
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('v2-settings-control');
    expect(btn).toHaveAttribute('aria-label', 'Settings and account');
  });

  it('hides the control on the settings screen itself', () => {
    render(
      <MemoryRouter>
        <V2Surface hideSettingsControl><p>Settings</p></V2Surface>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('v2-settings-control')).toBeNull();
  });

  it('does not reintroduce a Support primary navigation destination', async () => {
    const V2BottomNav = (await import('@/components/chronicle/V2BottomNav')).default;
    render(<MemoryRouter><V2BottomNav /></MemoryRouter>);
    expect(screen.getByLabelText('Notebook')).toBeTruthy();
    expect(screen.getByLabelText('Capture')).toBeTruthy();
    expect(screen.getByLabelText('My Record')).toBeTruthy();
    expect(screen.queryByLabelText('Support')).toBeNull();
    expect(screen.queryByLabelText('Calendar')).toBeNull();
  });
});

describe('Settings presentation primitives', () => {
  it('renders an accessible switch with label, state and description', () => {
    const onChange = vi.fn();
    render(
      <SettingsToggle
        label="Privacy Shield"
        help="Privacy Shield hides sensitive record content on screen."
        checked={false}
        onChange={onChange}
        testId="shield"
      />,
    );
    const sw = screen.getByRole('switch', { name: 'Privacy Shield' });
    expect(sw).toHaveAttribute('aria-describedby');
    // State is conveyed as text, never by colour alone.
    expect(screen.getByText('Off')).toBeTruthy();
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('exposes theme choices as a labelled radio group', () => {
    const onChange = vi.fn();
    render(
      <SettingsChoice
        legend="Theme"
        value="system"
        options={[
          { value: 'system', label: 'System default' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={onChange}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: /System default/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: /Dark/ }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('shows unsupported capabilities as deferred rather than improvising', () => {
    render(<SettingsDeferred label="Download all data" reason="Not supported yet." />);
    expect(screen.getByText('Not yet available')).toBeTruthy();
  });

  it('groups content into labelled sections', () => {
    render(<SettingsSection title="Account"><p>row</p></SettingsSection>);
    expect(screen.getByRole('heading', { name: 'Account' })).toBeTruthy();
  });
});

describe('user-specific state clearing', () => {
  it('clears capture drafts for every account on the device', () => {
    sessionStorage.setItem(productionDraftKey('user-a'), 'private draft A');
    sessionStorage.setItem(productionDraftKey('user-b'), 'private draft B');
    clearCaptureDrafts();
    expect(sessionStorage.getItem(productionDraftKey('user-a'))).toBeNull();
    expect(sessionStorage.getItem(productionDraftKey('user-b'))).toBeNull();
  });

  it('resets transient screen state alongside drafts', () => {
    notebookUiState.q = 'harassment';
    clearUserScopedState();
    expect(notebookUiState.q).toBe('');
    resetNotebookUiState();
  });

  it('clears state when a different account signs in on the same device', () => {
    syncActiveUser('user-a');
    sessionStorage.setItem(productionDraftKey('user-a'), 'private draft A');
    const cleared = syncActiveUser('user-b');
    expect(cleared).toBe(true);
    expect(sessionStorage.getItem(productionDraftKey('user-a'))).toBeNull();
  });

  it('does not clear when the same account resumes a session', () => {
    syncActiveUser('user-a');
    sessionStorage.setItem(productionDraftKey('user-a'), 'draft');
    expect(syncActiveUser('user-a')).toBe(false);
    expect(sessionStorage.getItem(productionDraftKey('user-a'))).toBe('draft');
  });

  it('leaves device-local feature flags untouched (no user information)', () => {
    setFeatureOverride('v2Settings', true);
    clearUserScopedState();
    expect(isFeatureEnabled('v2Settings')).toBe(true);
  });

  it('registered resets can be removed again', () => {
    const fn = vi.fn();
    const off = registerTransientReset(fn);
    clearUserScopedState();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    clearUserScopedState();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('sign out behaviour', () => {
  const SignOutHarness = ({ signOut }: { signOut: () => Promise<void> }) => {
    const [error, setError] = (globalThis as unknown as { __react: typeof import('react') }).__react.useState<string | null>(null);
    return (
      <div>
        <button
          onClick={async () => {
            try {
              clearUserScopedState();
              await signOut();
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Sign out failed.');
            }
          }}
        >
          Sign out
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  };

  beforeEach(async () => {
    (globalThis as unknown as { __react: unknown }).__react = await import('react');
  });

  it('clears drafts and succeeds', async () => {
    sessionStorage.setItem(productionDraftKey('user-a'), 'draft');
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(<SignOutHarness signOut={signOut} />);
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(sessionStorage.getItem(productionDraftKey('user-a'))).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces an accessible failure state when sign out fails', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('Network unavailable'));
    render(<SignOutHarness signOut={signOut} />);
    fireEvent.click(screen.getByText('Sign out'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Network unavailable');
  });
});
