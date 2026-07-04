// Ambient declaration for Deno runtime env access from MCP tool files.
// These files are bundled by @lovable.dev/mcp-js into a Deno Edge Function
// where `process.env` is polyfilled; TypeScript in the Vite app project has
// no Node types, so we declare the minimal shape here.
declare const process: { env: Record<string, string | undefined> };
