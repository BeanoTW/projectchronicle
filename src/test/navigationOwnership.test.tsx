// Phase 8 regression — navigation ownership.
//
// Exactly one navigation system may be mounted for the screen on display, and
// ownership follows the rendered screen (not a global V2 boolean), so mixed
// flag states and browser Back stay correct.
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  NavigationOwnershipProvider,
  useOwnNavigationV2,
  resolveNavOwner,
} from '@/components/chronicle/NavigationOwnership';
import AppNavigation from '@/components/chronicle/AppNavigation';

/* Stand-ins for the real screens: a V2 screen is exactly a screen that claims
   navigation ownership; a V1 screen is one that does not. */
const V2Screen = ({ name }: { name: string }) => {
  useOwnNavigationV2();
  return <div>{name}</div>;
};
const V1Screen = ({ name }: { name: string }) => <div>{name}</div>;

const Shell = ({ path, children }: { path: string; children: React.ReactNode }) => (
  <MemoryRouter initialEntries={[path]}>
    <NavigationOwnershipProvider>
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
      <AppNavigation />
    </NavigationOwnershipProvider>
  </MemoryRouter>
);

const v1Nav = () => screen.queryByTestId('v1-bottom-nav');
const v2Nav = () => screen.queryByTestId('v2-bottom-nav');

describe('navigation ownership', () => {
  it('resolves owner from live claims only', () => {
    expect(resolveNavOwner(0)).toBe('v1');
    expect(resolveNavOwner(1)).toBe('v2');
    expect(resolveNavOwner(2)).toBe('v2');
  });

  it.each([
    ['V2 Notebook', '/timeline'],
    ['V2 Entry', '/incident/abc'],
    ['V2 Capture', '/record'],
    ['V2 Capture details', '/record/details/abc'],
    ['V2 My Record', '/export'],
  ])('%s does not render the V1 bottom nav', (name, path) => {
    render(<Shell path={path}><V2Screen name={name} /></Shell>);
    expect(v2Nav()).toBeTruthy();
    expect(v1Nav()).toBeNull();
  });

  it('V1 screens still render the legacy nav when their flag is off', () => {
    render(<Shell path="/timeline"><V1Screen name="V1 Timeline" /></Shell>);
    expect(v1Nav()).toBeTruthy();
    expect(v2Nav()).toBeNull();
  });

  it('mixed flag states: V2 notebook screen owns nav, V1 entry screen does not', () => {
    const a = render(<Shell path="/timeline"><V2Screen name="V2 Notebook" /></Shell>);
    expect(v2Nav()).toBeTruthy();
    a.unmount();

    render(<Shell path="/incident/abc"><V1Screen name="V1 Entry" /></Shell>);
    expect(v1Nav()).toBeTruthy();
    expect(v2Nav()).toBeNull();
  });

  it('mixed flag states: V1 capture + V2 my record', () => {
    const a = render(<Shell path="/record"><V1Screen name="V1 Capture" /></Shell>);
    expect(v1Nav()).toBeTruthy();
    a.unmount();

    render(<Shell path="/export"><V2Screen name="V2 My Record" /></Shell>);
    expect(v2Nav()).toBeTruthy();
    expect(v1Nav()).toBeNull();
  });

  it('navigating V2 -> V1 releases ownership (no stale nav after Back)', () => {
    const Screens = ({ v2 }: { v2: boolean }) => (v2 ? <V2Screen name="v2" /> : <V1Screen name="v1" />);
    const { rerender } = render(
      <MemoryRouter initialEntries={['/timeline']}>
        <NavigationOwnershipProvider>
          <Screens v2 />
          <AppNavigation />
        </NavigationOwnershipProvider>
      </MemoryRouter>,
    );
    expect(v2Nav()).toBeTruthy();

    act(() => {
      rerender(
        <MemoryRouter initialEntries={['/calendar']}>
          <NavigationOwnershipProvider>
            <Screens v2={false} />
            <AppNavigation />
          </NavigationOwnershipProvider>
        </MemoryRouter>,
      );
    });
    expect(v1Nav()).toBeTruthy();
    expect(v2Nav()).toBeNull();
  });

  it('full V2 mode never renders the old navigation', () => {
    for (const path of ['/timeline', '/record', '/incident/x', '/export']) {
      const r = render(<Shell path={path}><V2Screen name="v2" /></Shell>);
      expect(v1Nav()).toBeNull();
      expect(v2Nav()).toBeTruthy();
      r.unmount();
    }
  });

  it('the V2 nav reserves its own bottom spacing', () => {
    render(<Shell path="/timeline"><V2Screen name="v2" /></Shell>);
    const spacer = v2Nav()!.querySelector('[aria-hidden]') as HTMLElement;
    expect(spacer).toBeTruthy();
    expect(spacer.style.height).toBe('72px');
  });
});
