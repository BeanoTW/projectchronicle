import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./registerSW";
import { analytics } from "./lib/analytics/analytics";
import { startSessionTracking } from "./lib/analytics/sessionTracker";

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA service worker (no-op in dev, iframes, and Lovable preview).
registerServiceWorker();

// Initialise analytics + retention tracking.
analytics.init();
startSessionTracking();

