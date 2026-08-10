// Phase 9 — Settings surface, sign out, account safety.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  SettingsChoice,
  SettingsSection,
  SettingsToggle,
  SettingsDeferred,
} from '@/chronicle/shared/SettingsView';
import AppSurface from '@/chronicle/shared/AppSurface';
import {
  clearCaptureDrafts,
  clearUserScopedState,
  registerTransientReset,
  syncActiveUser,
} from '@/chronicle/shared/sessionCleanup';
import { productionDraftKey } from '@/chronicle/shared/captureModel';
import { notebookUiState, resetNotebookUiState } from '@/chronicle/shared/notebookUiState';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});


describe('App shell settings access', () => {
  it('every V2 surface exposes a secondary settings control', () => {
    render(
      <MemoryRouter>
        <AppSurface><p>Notebook</p></AppSurface>
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('v2-settings-control');
    expect(btn).toHaveAttribute('aria-label', 'Settings and account');
  });

  it('hides the control on the settings screen itself', () => {
    render(
      <MemoryRouter>
        <AppSurface hideSettingsControl><p>Settings</p></AppSurface>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('v2-settings-control')).toBeNull();
  });

  it('does not reintroduce a Support primary navigation destination', async () => {
    const AppBottomNav = (await import('@/components/chronicle/AppBottomNav')).default;
    render(<MemoryRouter><AppBottomNav /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Notebook' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Capture' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'My Record' })).toBeTruthy();
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
    const [error, setError] = useState<string | null>(null);
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
