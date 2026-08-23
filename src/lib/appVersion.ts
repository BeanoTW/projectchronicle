// App version + release id. Increment APP_VERSION when shipping a release that
// users should refresh into. The build hash from Vite (import.meta.env) gives
// per-build differentiation for SW update detection.

export const APP_VERSION = '1.6.2';

// Short, neutral, trust-focused notes shown in the "What changed" panel.
// Keep entries terse — bullet style.
export const RELEASE_NOTES: string[] = [
  'The final generic system screens now use Chronicle’s finished paper-and-ink design.',
  'Updates are now detected on launch, reconnect and return, with a reliable Update button.',
  'Backup & recovery now has one clear centre for status, manual backup, restore and conflict review.',
  'Attachment deletion now uses confirmation, transcript warnings and stronger ownership checks.',
  'App lock can now be configured with a PIN, biometric unlock and an automatic timeout.',
  'Cloud backup can now be turned on directly from Settings.',
  'Give attachments clear names without changing the original evidence file.',
  'Installed Chronicle apps now use the new bound-folio launcher icon.',
  'Daily record entries now appear in Timeline and Calendar.',
  'Saving no longer shows a warning when AI assist is unavailable.',
  'Password reset flow improved — clearer rules and recovery.',
];
