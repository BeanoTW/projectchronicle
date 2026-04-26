/**
 * Attachment integrity helpers for Chronicle.
 *
 * - `computeSha256(file)` returns a lowercase hex SHA-256 of the file's bytes.
 * - `verifyAttachmentHash(file, expected)` compares against a stored hash.
 *
 * The hash is computed in the browser via WebCrypto. It is persisted on the
 * `evidence_files.file_hash` column at upload time. Existing rows with a NULL
 * hash are treated as "integrity not recorded" — we do NOT retroactively
 * download and hash existing files.
 *
 * EXIF / GPS extraction is intentionally out of scope for this pass to keep
 * behaviour deterministic and avoid new dependencies.
 */

function bytesToHex(bytes: Uint8Array): string {
  const hex: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hex[i] = bytes[i].toString(16).padStart(2, '0');
  }
  return hex.join('');
}

export async function computeSha256(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyAttachmentHash(file: Blob, expected: string): Promise<boolean> {
  if (!expected) return false;
  const actual = await computeSha256(file);
  return actual.toLowerCase() === expected.toLowerCase();
}

/**
 * Best-effort capture timestamp for an uploaded file.
 *
 * For browser uploads we don't have OS-level capture metadata, so we use
 * `File.lastModified` when the platform reports a sensible value, and fall
 * back to "now" (the upload moment). The DB also records `upload_date` via
 * its column default, so callers always have at least one trustworthy
 * timestamp.
 */
export function deriveCaptureDate(file: File): string {
  const lm = typeof file.lastModified === 'number' ? file.lastModified : 0;
  // Some browsers report lastModified = 0 or the epoch for synthesised Files
  // (e.g. clipboard paste). Treat anything before 2000-01-01 as missing.
  const MIN = new Date('2000-01-01T00:00:00Z').getTime();
  if (lm >= MIN && lm <= Date.now() + 60_000) {
    return new Date(lm).toISOString();
  }
  return new Date().toISOString();
}
