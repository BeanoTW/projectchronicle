import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./registerSW";
import { cleanupObsoleteClientState } from "./lib/clientStateCleanup";
import { analytics } from "./lib/analytics/analytics";
import { startSessionTracking } from "./lib/analytics/sessionTracker";
import { applyPalette, readPalette } from "./lib/themeLab";


// Phase 11 — drop obsolete V1/prototype/feature-flag state before first paint
// so no stale browser state can force an old UI. Records are never touched.
cleanupObsoleteClientState();

// Temporary: apply the selected comparison palette before first paint.
applyPalette(readPalette());

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
