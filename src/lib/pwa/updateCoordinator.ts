type UpdateActivator = () => Promise<void>;
type UpdateChecker = () => Promise<void>;
type UpdateListener = (available: boolean) => void;

const SNOOZE_KEY = 'chronicle-update-snoozed-release';
const CHANNEL_NAME = 'chronicle-app-updates';

let pending = false;
let activator: UpdateActivator | null = null;
let checker: UpdateChecker | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<UpdateListener>();

const isSnoozed = (releaseId: string) => {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === releaseId;
  } catch {
    return false;
  }
};

const notify = (releaseId: string) => {
  const available = pending && !isSnoozed(releaseId);
  listeners.forEach(listener => listener(available));
};

const ensureChannel = (releaseId: string) => {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', event => {
    if (event.data?.type !== 'update-available') return;
    pending = true;
    notify(releaseId);
  });
};

export const announceUpdate = (releaseId: string, nextActivator?: UpdateActivator) => {
  pending = true;
  if (nextActivator) activator = nextActivator;
  ensureChannel(releaseId);
  notify(releaseId);
  try {
    channel?.postMessage({ type: 'update-available' });
  } catch {
    // Cross-tab notification is an enhancement; the current tab still updates.
  }
};

export const subscribeToUpdates = (
  releaseId: string,
  listener: UpdateListener,
): (() => void) => {
  ensureChannel(releaseId);
  listeners.add(listener);
  listener(pending && !isSnoozed(releaseId));
  return () => listeners.delete(listener);
};

export const snoozeUpdateForSession = (releaseId: string) => {
  try {
    sessionStorage.setItem(SNOOZE_KEY, releaseId);
  } catch {
    // If session storage is unavailable, still hide it for the current render.
  }
  notify(releaseId);
};


export const setUpdateChecker = (nextChecker: UpdateChecker) => {
  checker = nextChecker;
};

export const requestAppUpdateCheck = async () => {
  if (checker) {
    await checker();
    return;
  }
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update();
};

export const activatePendingUpdate = async (releaseId: string) => {
  try {
    sessionStorage.removeItem(SNOOZE_KEY);
  } catch {
    // no-op
  }

  if (activator) {
    await activator();
    return;
  }

  // Fallback for a second tab that heard the BroadcastChannel message before
  // its own Workbox callback supplied an activator.
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    await new Promise<void>(resolve => {
      const timeout = window.setTimeout(resolve, 4000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  } else {
    await registration?.update();
  }
  window.location.reload();
};

export const resetUpdateCoordinatorForTests = () => {
  pending = false;
  activator = null;
  checker = null;
  listeners.clear();
  channel?.close();
  channel = null;
  try {
    sessionStorage.removeItem(SNOOZE_KEY);
  } catch {
    // no-op
  }
};
