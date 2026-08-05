import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./registerSW";
import { analytics } from "./lib/analytics/analytics";
import { startSessionTracking } from "./lib/analytics/sessionTracker";
import { applyFlagOverridesFromUrl } from "./lib/featureFlags";

// Migration feature flags: apply any `?ff=` overrides before the app renders.
applyFlagOverridesFromUrl();


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
