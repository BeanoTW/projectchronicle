// Single source of truth for Chronicle's application navigation.
//
// Mobile (<768px)  → hamburger + slide-out drawer + floating Capture action
// Tablet (768–1023) → compact icon rail
// Desktop (>=1024) → full left rail
//
// All three presentations read this model, so a destination is added once.
import type { ReactNode } from 'react';

export type NavGroup = 'primary' | 'secondary';

export interface NavDestination {
  path: string;
  label: string;
  hint: string;
  group: NavGroup;
  /** Extra paths that should light this destination up. */
  matches?: (pathname: string) => boolean;
}

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const navIcon = (path: string) => {
  switch (path) {
    case '/home':
      return icon(<><path d="M4 10.5 12 4l8 6.5" /><path d="M6.5 9.5V20h11V9.5" /></>);
    case '/timeline':
      return icon(<><path d="M5 4.5h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2z" /><path d="M8 8.5h7M8 12h7M8 15.5h4" /></>);
    case '/export':
      return icon(<><path d="M7 3.5h7l4 4v13H7z" /><path d="M14 3.5v4h4" /><path d="M10 13h5M10 16.5h3" /></>);
    case '/attachments':
      return icon(<><path d="M15.5 8.5 9 15a2.5 2.5 0 0 1-3.5-3.5l7-7a4 4 0 0 1 5.7 5.7l-7 7" /></>);
    case '/settings':
      return icon(<><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" /></>);
    case '/support':
      return icon(<><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.4a2.3 2.3 0 1 1 3 2.2c-.6.2-.9.7-.9 1.4" /><path d="M12 16.4h.01" /></>);
    default:
      return icon(<circle cx="12" cy="12" r="8" />);
  }
};

export const captureAction = {
  path: '/record',
  label: 'Capture',
  desktopLabel: 'New record',
  matches: (pathname: string) => pathname.startsWith('/record'),
};

export const destinations: NavDestination[] = [
  { path: '/home', label: 'Home', hint: 'Everything at a glance', group: 'primary' },
  {
    path: '/timeline',
    label: 'Notebook',
    hint: 'Browse and find records',
    group: 'primary',
    matches: p => p === '/timeline' || p.startsWith('/incident/'),
  },
  {
    path: '/export',
    label: 'Chronicle',
    hint: 'Records you have brought together',
    group: 'primary',
    matches: p => p === '/export' || p === '/my-record',
  },
  {
    path: '/attachments',
    label: 'Attachments',
    hint: 'Files linked to your records',
    group: 'primary',
    matches: p => p === '/attachments' || p === '/evidence',
  },
  { path: '/settings', label: 'Settings', hint: 'Account, privacy, data', group: 'secondary' },
  { path: '/support', label: 'Support', hint: 'Information and resources', group: 'secondary' },
];

export const isDestinationActive = (destination: NavDestination, pathname: string) =>
  destination.matches ? destination.matches(pathname) : pathname === destination.path;

/** Capture is an action, not a destination — the capture screen hides the FAB. */
export const isCaptureSurface = (pathname: string) => captureAction.matches(pathname);
