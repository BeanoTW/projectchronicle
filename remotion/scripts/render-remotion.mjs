import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition, openBrowser } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || 'vertical';
const out = process.argv[3] || `/mnt/documents/chronicle-demo-${target}.mp4`;

console.log(`Bundling…`);
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, '../src/index.ts'),
  webpackOverride: (config) => config,
});

console.log(`Opening browser…`);
const browser = await openBrowser('chrome', {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/bin/chromium',
  chromiumOptions: { args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] },
  chromeMode: 'chrome-for-testing',
});

console.log(`Selecting composition: ${target}`);
const composition = await selectComposition({
  serveUrl: bundled,
  id: target,
  puppeteerInstance: browser,
});

console.log(`Rendering ${composition.width}x${composition.height} → ${out}`);
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: 'h264',
  outputLocation: out,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 1,
});

await browser.close({ silent: false });
console.log(`Done: ${out}`);
