/**
 * Service worker registration with strict guards.
 *
 * Never registers in:
 * - dev mode
 * - iframes (Lovable preview)
 * - lovable preview hosts
 *
 * Actively unregisters any pre-existing SW in those contexts so stale caches
 * from earlier visits cannot pollute the editor preview.
 */

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.app") && host.includes("id-preview--");

const isLocalhost = host === "localhost" || host === "127.0.0.1";

const shouldRegister =
  import.meta.env.PROD && !isInIframe && !isPreviewHost && !isLocalhost;

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (!shouldRegister) {
    // Clean up any SW that might have been registered previously in this scope.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* no-op */
    }
    return;
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    let reloadingForUpdate = false;

    // When a newly activated worker takes control, reload exactly once so the
    // page and its controller always come from the same release.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });

    const reload = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          // Check immediately on every launch, then periodically while open.
          // This prevents an installed Chronicle tab from waiting an hour
          // before learning that a newer branded shell is available.
          registration.update().catch(() => {});
          setInterval(() => registration.update().catch(() => {}), 5 * 60 * 1000);
        }
      },
      onNeedRefresh() {
        console.info("[Chronicle] New version available — reload to update.");
        // Non-blocking: dispatch an event so UpdateBanner can offer Refresh.
        window.dispatchEvent(
          new CustomEvent("chronicle:update-available", {
            detail: { reload: () => reload(true) },
          }),
        );
      },
      onOfflineReady() {
        console.info("[Chronicle] App shell cached. Ready for offline boot.");
      },
    });
  } catch (err) {
    console.warn("[Chronicle] SW registration skipped:", err);
  }
}
