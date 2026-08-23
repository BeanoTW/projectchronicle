import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activatePendingUpdate,
  announceUpdate,
  requestAppUpdateCheck,
  resetUpdateCoordinatorForTests,
  setUpdateChecker,
  snoozeUpdateForSession,
  subscribeToUpdates,
} from '@/lib/pwa/updateCoordinator';

const RELEASE = '1.6.1';

afterEach(() => {
  resetUpdateCoordinatorForTests();
  sessionStorage.clear();
});

describe('PWA update coordinator', () => {
  it('does not lose an update announced before the banner subscribes', () => {
    announceUpdate(RELEASE, vi.fn().mockResolvedValue(undefined));
    const listener = vi.fn();

    const unsubscribe = subscribeToUpdates(RELEASE, listener);

    expect(listener).toHaveBeenLastCalledWith(true);
    unsubscribe();
  });

  it('snoozes only the current running release session', () => {
    const listener = vi.fn();
    subscribeToUpdates(RELEASE, listener);
    announceUpdate(RELEASE, vi.fn().mockResolvedValue(undefined));

    snoozeUpdateForSession(RELEASE);

    expect(listener).toHaveBeenLastCalledWith(false);

    const newerListener = vi.fn();
    subscribeToUpdates('1.6.2', newerListener);
    expect(newerListener).toHaveBeenLastCalledWith(true);
  });

  it('runs the registered manual update checker', async () => {
    const checker = vi.fn().mockResolvedValue(undefined);
    setUpdateChecker(checker);

    await expect(requestAppUpdateCheck()).resolves.toBe(true);
    expect(checker).toHaveBeenCalledTimes(1);
  });

  it('activates the exact waiting update supplied by registration', async () => {
    const activate = vi.fn().mockResolvedValue(undefined);
    announceUpdate(RELEASE, activate);

    await activatePendingUpdate(RELEASE);

    expect(activate).toHaveBeenCalledTimes(1);
  });
});
