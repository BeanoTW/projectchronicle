/**
 * Share an exported HTML document via the native share sheet.
 *
 * Strict contract:
 *  - If navigator.canShare({ files }) is true → call navigator.share({ files })
 *    immediately. No download, no window.open, no URL sharing.
 *  - If file sharing is NOT supported → fall back to anchor download.
 *  - If the user cancels the share sheet → return 'cancelled' (no download).
 *  - If share() throws for another reason → return 'failed' (no download).
 *
 * navigator.share MUST be called inside the user gesture. Callers should
 * therefore avoid awaiting other async work before invoking this function.
 */

export type ShareResult = 'shared' | 'cancelled' | 'downloaded' | 'unsupported' | 'failed';

export async function shareExportFile(html: string, filename: string, title?: string): Promise<ShareResult> {
  let blob: Blob;
  let file: File;
  try {
    blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    file = new File([blob], filename, { type: 'text/html' });
  } catch {
    return 'failed';
  }

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };

  const supportsFileShare =
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    (() => { try { return nav.canShare!({ files: [file] }); } catch { return false; } })();

  if (supportsFileShare) {
    try {
      await nav.share!({ files: [file], title: title || 'Record export' });
      return 'shared';
    } catch (e: unknown) {
      const err = e as Error;
      if (err?.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }

  // Fallback only when file-share is unsupported.
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
