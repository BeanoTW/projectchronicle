/**
 * Delivery layer for generated report files, and the print path.
 *
 * Why this exists: anchor-triggered downloads and `window.print()` are silently
 * ignored in embedded/sandboxed browsing contexts (the Lovable preview frame,
 * in-app webviews) and in some mobile browsers. The generation code ran fine —
 * the browser simply dropped the delivery, so the UI appeared to do nothing.
 *
 * Every function here reports what actually happened so the screen can offer a
 * manual fallback link instead of failing silently.
 */

export interface Delivery {
  status: 'downloaded' | 'blocked';
  /** Object URL kept alive so the UI can offer a manual open/download link. */
  url: string;
  filename: string;
}

const REVOKE_AFTER_MS = 5 * 60 * 1000;

/** Attempts a normal download; always returns a URL for a manual fallback. */
export function deliverBlob(blob: Blob, filename: string): Delivery {
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { status: 'downloaded', url, filename };
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[my-record] download blocked', err);
    return { status: 'blocked', url, filename };
  }
}

/** True when the app is running inside another document (preview frame, webview). */
export function isEmbedded(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

export type PrintResult = 'printed' | 'nothing-to-print' | 'blocked';

/**
 * Prints the report only — never the app shell.
 *
 * The report node is cloned into a same-origin iframe carrying the app's
 * stylesheets, so the printed output cannot include navigation or
 * configuration controls, and does not depend on print-only visibility rules
 * in the main document.
 */
export function printReport(targetId = 'proto-doc'): PrintResult {
  const node = document.getElementById(targetId);
  if (!node) return 'nothing-to-print';

  const styles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]'),
  )
    .map(el => el.outerHTML)
    .join('\n');

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);

  const cleanup = () => setTimeout(() => frame.remove(), 1000);

  try {
    const win = frame.contentWindow;
    const docu = frame.contentDocument;
    if (!win || !docu) {
      frame.remove();
      return 'blocked';
    }
    docu.open();
    docu.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${document.title}</title>${styles}` +
        `<style>@page{size:A4;margin:18mm 16mm}body{margin:0;background:#fff}` +
        `.proto-noprint{display:none !important}</style></head>` +
        `<body class="proto-root"><div class="proto-surface">${node.outerHTML}</div></body></html>`,
    );
    docu.close();

    const doPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[my-record] print blocked', err);
      } finally {
        cleanup();
      }
    };
    // Give the cloned stylesheets a tick to apply.
    if (docu.readyState === 'complete') setTimeout(doPrint, 60);
    else frame.onload = () => setTimeout(doPrint, 60);
    return 'printed';
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[my-record] print unavailable', err);
    frame.remove();
    return 'blocked';
  }
}
