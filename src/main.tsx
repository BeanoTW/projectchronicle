import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
// Chronicle design-system layer; deliberately self-contained (no remote font requests).
import "./chronicle/premium.css";
import { registerServiceWorker } from "./registerSW";
import { cleanupObsoleteClientState } from "./lib/clientStateCleanup";
import { analytics } from "./lib/analytics/analytics";
import { startSessionTracking } from "./lib/analytics/sessionTracker";
import { recoverConfirmedLocalAccountErasure } from "./chronicle/shared/accountErasure";

const bootstrap = async () => {
  // Drop obsolete prototype/feature-flag state before first paint. Records are never touched here.
  cleanupObsoleteClientState();

  // A server-confirmed account deletion may have been interrupted by a tab/app
  // close before IndexedDB cleanup committed. Retry that owner-scoped purge
  // before any Chronicle surface can render local data. Failure keeps the
  // marker so a later launch can retry; normal storage remains untouched.
  try {
    await recoverConfirmedLocalAccountErasure();
  } catch (error) {
    console.error('[account-erasure] local recovery failed; will retry on next launch', error);
  }

  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  // Register PWA service worker (no-op in dev, iframes, and Lovable preview).
  registerServiceWorker();

  // Initialise analytics + retention tracking.
  analytics.init();
  startSessionTracking();
};

void bootstrap();
