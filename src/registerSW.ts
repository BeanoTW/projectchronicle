/**
 * Service worker registration with strict guards and explicit update control.
 *
 * Production checks on launch, reconnect, returning to the app and hourly.
 * A newly installed worker waits until the user chooses Update, preventing
 * open capture forms in other tabs from being reloaded without warning.
 */
import { APP_VERSION } from '@/lib/appVersion';
import { announceUpdate } from '@/lib/pwa/updateCoordinator';

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes('id-preview--') ||
  host.includes('lovableproject.com') ||
  host.includes('lovable.app') && host.includes('id-preview--');

const isLocalhost = host === 'localhost' || host === '127.0.0.1';

const shouldRegister =
  import.meta.env.PROD && !isInIframe && !isPreviewHost && !isLocalhost;

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (!shouldRegister) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    } catch {
      // Preview cleanup is best-effort.
    }
    return;
  }

  try {
    const { registerSW } = await import('virtual:pwa-register');

    const updateSW = registerSW({
      immediate: true,
      registrationOptions: {
        // Never reuse an HTTP-cached worker script when checking for a release.
        updateViaCache: 'none',
      },
      onRegisteredSW(swUrl, registration) {
        if (!registration) return;

        let checking = false;
        const checkForUpdate = async () => {
          if (checking || registration.installing || navigator.onLine === false) return;
          checking = true;
          try {
            // The no-store request catches stale hosting/CDN responses before
            // asking the browser to run its service-worker update algorithm.
            const response = await fetch(swUrl, {
              cache: 'no-store',
              headers: {
                'cache': 'no-store',
                'cache-control': 'no-cache',
              },
            });
            if (response.ok) await registration.update();
          } catch {
            // A failed check changes no caches and will retry at the next trigger.
          } finally {
            checking = false;
          }
        };

        void checkForUpdate();
        window.setInterval(() => { void checkForUpdate(); }, UPDATE_INTERVAL_MS);
        window.addEventListener('online', checkForUpdate);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void checkForUpdate();
        });
      },
      onNeedRefresh() {
        announceUpdate(APP_VERSION, () => updateSW(true));
      },
      onOfflineReady() {
        console.info('[Chronicle] App shell cached. Ready for offline use.');
      },
      onRegisterError(error) {
        console.warn('[Chronicle] Service worker registration failed:', error);
      },
    });
  } catch (error) {
    console.warn('[Chronicle] Service worker registration skipped:', error);
  }
}
