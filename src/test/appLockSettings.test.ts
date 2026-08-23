import { describe, expect, it } from 'vitest';
import { APP_LOCK_TIMEOUT_OPTIONS, validateLockPinSetup } from '@/lib/lock/lockSettings';

describe('app lock settings', () => {
  it('accepts matching numeric PINs containing 4 to 6 digits', () => {
    expect(validateLockPinSetup('1234', '1234')).toBeNull();
    expect(validateLockPinSetup('123456', '123456')).toBeNull();
  });

  it('rejects weak, non-numeric and mismatched PINs', () => {
    expect(validateLockPinSetup('123', '123')).toContain('4 to 6');
    expect(validateLockPinSetup('12ab', '12ab')).toContain('numbers');
    expect(validateLockPinSetup('1234', '4321')).toContain('do not match');
  });

  it('offers only timeouts supported by the lock engine', () => {
    expect(APP_LOCK_TIMEOUT_OPTIONS.map(option => Number(option.value))).toEqual([60_000, 300_000, 900_000]);
  });
});
