// App version + release id. Increment APP_VERSION when shipping a release that
// users should refresh into. The build hash from Vite (import.meta.env) gives
// per-build differentiation for SW update detection.

export const APP_VERSION = '1.5.0';

// Short, neutral, trust-focused notes shown in the "What changed" panel.
// Keep entries terse — bullet style.
export const RELEASE_NOTES: string[] = [
  'Chronicle branding now appears consistently across the app and reports.',
  'Daily record entries now appear in Timeline and Calendar.',
  'Saving no longer shows a warning when AI assist is unavailable.',
  'Password reset flow improved — clearer rules and recovery.',
  'Update banner: refresh on your terms, never automatic.',
];
