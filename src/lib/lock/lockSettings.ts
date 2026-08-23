export const APP_LOCK_TIMEOUT_OPTIONS = [
  { value: '60000', label: 'After 1 minute' },
  { value: '300000', label: 'After 5 minutes' },
  { value: '900000', label: 'After 15 minutes' },
] as const;

export const validateLockPinSetup = (pin: string, confirmation: string): string | null => {
  if (!/^\d{4,6}$/.test(pin)) return 'Choose a PIN containing 4 to 6 numbers.';
  if (pin !== confirmation) return 'The PINs do not match.';
  return null;
};
