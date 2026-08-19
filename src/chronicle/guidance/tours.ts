// Step content for Chronicle's guided introductions.
//
// Targets are candidate selectors, most specific first, so the same step works
// on phone (drawer + floating Capture), tablet (compact rail) and desktop
// (full rail) without hard-coded coordinates.
import type { GuidanceStep } from './guidanceModel';

export const appTourSteps: GuidanceStep[] = [
  {
    id: 'home',
    title: 'Home',
    body: 'Home gives you a quick view of your records and anything that needs your attention.',
    targets: ['[data-testid="home-view"]'],
  },
  {
    id: 'capture',
    title: 'Capture',
    body: "Record something while it's fresh. You can write it, speak it, and attach supporting files.",
    targets: [
      '[data-testid="capture-fab"]',
      '.proto-sidenav-action',
      '[data-testid="home-capture"]',
    ],
    prefer: 'top',
  },
  {
    id: 'notebook',
    title: 'Notebook',
    body: 'Everything you record is kept in your Notebook, in chronological order.',
    targets: [
      '[data-guide="nav-timeline"]',
      '[data-testid="home-notebook-tile"]',
    ],
  },
  {
    id: 'chronicle',
    title: 'Chronicle',
    body: 'Bring selected records together in your Chronicle when you want to create a report.',
    targets: [
      '[data-guide="nav-export"]',
      '[data-testid="home-myrecord-tile"]',
    ],
  },
  {
    id: 'navigation',
    title: 'Finding everything else',
    body: 'Attachments, Support and Settings live in the navigation — the menu on a phone, the sidebar on a larger screen.',
    targets: [
      '[data-testid="app-side-nav"]',
      '[data-testid="nav-menu-button"]',
    ],
  },
];

export const APP_TOUR_FINAL_NOTE = "You're ready.";

export const chronicleTourSteps: GuidanceStep[] = [
  {
    id: 'membership',
    title: 'Your Chronicle',
    body: 'Choose which records you want to bring together in your Chronicle.',
    targets: ['[data-guide="chronicle-records"]'],
  },
  {
    id: 'filters',
    title: 'Filter records',
    body: "Use filters to find the records you need. Filtering doesn't change your saved records.",
    targets: ['[data-guide="chronicle-filters"]'],
  },
  {
    id: 'options',
    title: 'Report options',
    body: 'Choose what information appears alongside your original records.',
    targets: ['[data-guide="chronicle-options"]'],
  },
  {
    id: 'preview',
    title: 'Report preview',
    body: 'See how your Chronicle will look before you export or print it.',
    targets: ['[data-guide="chronicle-preview"]', '[data-guide="chronicle-preview-tab"]'],
  },
];

export const CHRONICLE_HELP_TEXT = [
  'Your Notebook holds everything you have recorded.',
  'Your Chronicle contains the records you have chosen to bring together.',
  'Filters help you find records and do not alter them.',
  'Report options control what additional information appears in your report.',
  'Your original sealed wording is never changed by configuring your Chronicle.',
];
