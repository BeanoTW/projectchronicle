import { supabase } from '@/integrations/supabase/client';
import type { Delivery } from './deliver';

export type TrustedTimestampStatus = 'success' | 'failed' | 'unavailable';

export interface TrustedTimestampResult {
  status: TrustedTimestampStatus;
  authority: string | null;
  timestampAt: string | null;
  token: string | null;
  tokenFormat: string | null;
  note: string | null;
}

export interface ExportIntegrityReceipt {
  schemaVersion: 1;
  reportFilename: string;
  hashAlgorithm: 'SHA-256';
  sha256: string;
  createdAt: string;
  trustedTimestamp: TrustedTimestampResult;
  meaning: string;
}

export interface IntegrityReceiptLink {
  url: string;
  filename: string;
  receipt: ExportIntegrityReceipt;
}

const RECEIPT_URL_LIFETIME_MS = 5 * 60 * 1000;

const toHex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

export const sha256Blob = async (blob: Blob): Promise<string> => {
  const bytes = await blob.arrayBuffer();
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
};

const unavailable = (note: string): TrustedTimestampResult => ({
  status: 'unavailable', authority: null, timestampAt: null, token: null, tokenFormat: null, note,
});

export const requestTrustedTimestamp = async (hash: string): Promise<TrustedTimestampResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('rfc3161-timestamp', { body: { hash } });
    if (error || !data || typeof data.status !== 'string') {
      return unavailable('Trusted timestamp service did not return a usable response.');
    }
    if (!['success', 'failed', 'unavailable'].includes(data.status)) {
      return unavailable('Trusted timestamp service returned an unknown status.');
    }
    return {
      status: data.status as TrustedTimestampStatus,
      authority: typeof data.authority === 'string' ? data.authority : null,
      timestampAt: typeof data.timestampAt === 'string' ? data.timestampAt : null,
      token: typeof data.token === 'string' ? data.token : null,
      tokenFormat: typeof data.tokenFormat === 'string' ? data.tokenFormat : null,
      note: typeof data.note === 'string' ? data.note : null,
    };
  } catch {
    return unavailable('Trusted timestamp service could not be reached.');
  }
};

export const buildExportIntegrityReceipt = async (
  reportBlob: Blob,
  reportFilename: string,
  timestamp: (hash: string) => Promise<TrustedTimestampResult> = requestTrustedTimestamp,
  clock: () => string = () => new Date().toISOString(),
): Promise<ExportIntegrityReceipt> => {
  const sha256 = await sha256Blob(reportBlob);
  const trustedTimestamp = await timestamp(sha256);
  return {
    schemaVersion: 1,
    reportFilename,
    hashAlgorithm: 'SHA-256',
    sha256,
    createdAt: clock(),
    trustedTimestamp,
    meaning: 'This receipt fingerprints the exported file. A successful trusted timestamp records that this SHA-256 fingerprint was presented to the named timestamp authority at the stated time. It does not certify the truth, authorship, legal status or admissibility of the report contents.',
  };
};

/**
 * Build a user-downloadable sidecar for an already generated report. The report
 * download itself is never blocked by hashing or timestamp-service failure.
 */
export const createIntegrityReceiptLink = async (
  delivery: Delivery,
  timestamp: (hash: string) => Promise<TrustedTimestampResult> = requestTrustedTimestamp,
): Promise<IntegrityReceiptLink> => {
  const response = await fetch(delivery.url);
  if (!response.ok) throw new Error('Generated report could not be read for fingerprinting.');
  const reportBlob = await response.blob();
  const receipt = await buildExportIntegrityReceipt(reportBlob, delivery.filename, timestamp);
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), RECEIPT_URL_LIFETIME_MS);
  return { url, filename: `${delivery.filename}.integrity.json`, receipt };
};
