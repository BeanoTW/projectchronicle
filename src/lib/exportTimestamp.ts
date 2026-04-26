/**
 * Export timestamping — independent trusted timestamping for export fingerprints.
 *
 * Goal:
 *   Provide a future-ready abstraction for RFC 3161 Trusted Timestamping over
 *   the SHA-256 fingerprint of a generated export. The fingerprint is computed
 *   client-side; only the hash would ever be sent to a Timestamp Authority
 *   (TSA). No record content leaves the browser.
 *
 * Status (this pass):
 *   Full RFC 3161 integration is NOT enabled. We compute and persist the
 *   fingerprint and surface it in the UI and export, but the timestamp
 *   request returns `unavailable`. The data model and UI are wired so a
 *   real TSA backend (e.g. an Edge Function proxy to FreeTSA / DigiCert /
 *   Sectigo) can be plugged in without changing call sites.
 *
 * Hard rules:
 *   - Only the hex SHA-256 hash is ever sent to a TSA.
 *   - Timestamping failure NEVER blocks an export.
 *   - We never fabricate a token, time, or authority.
 *   - We never claim legal proof, authenticity, or chain of custody.
 */

import { supabase } from '@/integrations/supabase/client';

export type TimestampStatus = 'unavailable' | 'pending' | 'success' | 'failed';

export interface ExportTimestampRecord {
  /** Stable identifier for this export instance (UUID v4, client-generated). */
  exportId: string;
  /** Lowercase hex SHA-256 of the export HTML. */
  exportHash: string;
  /** Lifecycle status of the timestamp attempt. */
  status: TimestampStatus;
  /** TSA used (e.g. "freetsa.org"), if any. Null when status is unavailable. */
  authority: string | null;
  /** Base64-encoded RFC 3161 TimeStampToken (DER), if any. */
  token: string | null;
  /** Trusted time asserted by the TSA, if any. */
  timestampAt: string | null;
  /** When this fingerprint record was created locally (ISO). */
  createdAt: string;
  /** Optional human-readable note (e.g. failure reason). Never contains record content. */
  note: string | null;
}

/** Compute SHA-256 of a string (UTF-8 encoded). */
export async function computeExportFingerprint(html: string): Promise<string> {
  const bytes = new TextEncoder().encode(html);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  const hex: string[] = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) hex[i] = arr[i].toString(16).padStart(2, '0');
  return hex.join('');
}

function newExportId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: not cryptographic, only used as an opaque identifier.
  return 'export-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Request a trusted timestamp for the given export fingerprint by invoking
 * the `rfc3161-timestamp` Edge Function. ONLY the hex hash is transmitted.
 *
 * Failure is non-blocking by design: callers must continue with the export
 * regardless of the returned status.
 */
export async function requestTimestamp(hash: string): Promise<{
  status: TimestampStatus;
  authority: string | null;
  token: string | null;
  timestampAt: string | null;
  note: string | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('rfc3161-timestamp', {
      body: { hash },
    });
    if (error) {
      return {
        status: 'failed',
        authority: null,
        token: null,
        timestampAt: null,
        note: error.message ?? 'Timestamp request failed',
      };
    }
    const status = (data?.status as TimestampStatus) ?? 'failed';
    return {
      status,
      authority: data?.authority ?? null,
      token: data?.token ?? null,
      timestampAt: data?.timestampAt ?? null,
      note: data?.note ?? null,
    };
  } catch (e) {
    return {
      status: 'failed',
      authority: null,
      token: null,
      timestampAt: null,
      note: e instanceof Error ? e.message : 'Timestamp request error',
    };
  }
}

/**
 * High-level helper: hash + (optionally) timestamp + persist metadata.
 *
 * Persistence to `public.export_timestamps` is best-effort and silent on
 * failure. The returned record is the source of truth for the current call.
 */
export async function createExportTimestampRecord(html: string): Promise<ExportTimestampRecord> {
  const exportId = newExportId();
  const exportHash = await computeExportFingerprint(html);
  const createdAt = new Date().toISOString();

  let tsResult: Awaited<ReturnType<typeof requestTimestamp>>;
  try {
    tsResult = await requestTimestamp(exportHash);
  } catch (e) {
    tsResult = {
      status: 'failed',
      authority: null,
      token: null,
      timestampAt: null,
      note: e instanceof Error ? e.message : 'Timestamp request error',
    };
  }

  const record: ExportTimestampRecord = {
    exportId,
    exportHash,
    status: tsResult.status,
    authority: tsResult.authority,
    token: tsResult.token,
    timestampAt: tsResult.timestampAt,
    createdAt,
    note: tsResult.note,
  };

  // Best-effort persistence. Never block export on this.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('export_timestamps').insert({
        user_id: user.id,
        export_id: exportId,
        export_hash: exportHash,
        timestamp_authority: tsResult.authority,
        timestamp_token: tsResult.token,
        timestamp_at: tsResult.timestampAt,
        status: tsResult.status,
        note: tsResult.note,
      });
    }
  } catch (e) {
    // Swallow — timestamping must never block exporting.
    console.warn('[ExportTimestamp] Could not persist record:', e);
  }

  return record;
}

/**
 * Neutral, user-safe wording for the timestamp status. Never claims legal
 * proof, authenticity, or chain of custody.
 */
export function describeTimestampStatus(record: ExportTimestampRecord): string {
  switch (record.status) {
    case 'success':
      if (record.timestampAt && record.authority) {
        return `This export fingerprint was independently timestamped on ${formatDate(record.timestampAt)} by ${record.authority}. This confirms the fingerprint existed at or before that time.`;
      }
      return 'This export fingerprint was independently timestamped. This confirms the fingerprint existed at or before that time.';
    case 'pending':
      return 'The export fingerprint has been recorded by Chronicle. An independent trusted timestamp is being requested.';
    case 'failed':
      return 'Independent timestamping was attempted but did not complete. The fingerprint is still recorded by Chronicle.';
    case 'unavailable':
    default:
      return 'Fingerprint recorded by Chronicle; independent timestamping not currently available.';
  }
}

/**
 * Standardised human-readable timestamp format used across the export
 * footer, the integrity panel, and the status description sentence.
 * Example: "26 April 2026, 17:02" (local time, 24-hour clock).
 */
export function formatTimestampReadable(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const month = d.toLocaleString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  return formatTimestampReadable(iso);
}
