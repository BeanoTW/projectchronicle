/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Ambient declaration for Deno runtime env access used by @lovable.dev/mcp-js
// tool files under src/lib/mcp. Those files run in the emitted Deno Edge
// Function where `process.env` is polyfilled; this project has no Node types.
declare const process: { env: Record<string, string | undefined> };
