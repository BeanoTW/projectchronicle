import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./registerSW";

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA service worker (no-op in dev, iframes, and Lovable preview).
registerServiceWorker();
