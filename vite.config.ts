import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // we register manually with iframe/preview guards
      devOptions: {
        enabled: false, // never run SW in dev / Lovable preview
      },
      manifest: {
        name: "Project Chronicle",
        short_name: "Chronicle",
        description: "Secure workplace incident documentation platform.",
        display: "standalone",
        start_url: "/",
        theme_color: "#1A7A6E",
        background_color: "#F9FAFB",
        icons: [
          { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
        ],
      },
      workbox: {
        // App-shell precache only: built JS/CSS/HTML + manifest/icons/fonts.
        globPatterns: ["**/*.{js,css,html,ico,svg,webmanifest,woff,woff2}"],
        // Allow large bundled assets (e.g. logo PNG) to be precached.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // SPA fallback: offline navigations resolve to index.html so React
        // Router can take over and Dexie can hydrate local data.
        navigateFallback: "/index.html",
        // Never intercept auth callbacks, OAuth, Supabase, or edge functions.
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/auth\/callback/,
          /^\/reset-password/,
          /\/functions\/v1\//,
          /\/rest\/v1\//,
          /\/auth\/v1\//,
          /\/storage\/v1\//,
        ],
        // No runtime caching of dynamic / authenticated data.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // safer: wait for next reload to activate new SW
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
