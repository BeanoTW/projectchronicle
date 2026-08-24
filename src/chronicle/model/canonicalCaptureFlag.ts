// Phase 2 — owner-scoped canonical Capture flag.
//
// The flag has no UI and defaults off. Enabling it also requires an audited
// canonical activation receipt, so a test owner can never write records into a
// store their normal read path cannot see.
import { getCanonicalActivation, type CanonicalActivationReceipt } from './canonicalActivation';
import { ChronicleDB, localDB } from '@/local/db';

export const CANONICAL_CAPTURE_FLAG_VERSION = 1;

export interface CanonicalCaptureFlag {
  version: typeof CANONICAL_CAPTURE_FLAG_VERSION;
  owner_id: string;
  enabled_at: string;
}

export class CanonicalCaptureFlagBlockedError extends Error {}

export const canonicalCaptureFlagKey = (ownerId: string): string => `canonical_capture_enabled:${ownerId}`;

export const getCanonicalCaptureFlag = async (
  ownerId: string,
  db: ChronicleDB = localDB,
): Promise<CanonicalCaptureFlag | null> => {
  const row = await db.meta.get(canonicalCaptureFlagKey(ownerId));
  if (!row) return null;
  try {
    const value = JSON.parse(row.value) as Partial<CanonicalCaptureFlag>;
    if (
      value.version !== CANONICAL_CAPTURE_FLAG_VERSION
      || value.owner_id !== ownerId
      || typeof value.enabled_at !== 'string'
    ) return null;
    return value as CanonicalCaptureFlag;
  } catch {
    return null;
  }
};

export const isCanonicalCaptureEnabled = async (
  ownerId: string,
  db: ChronicleDB = localDB,
  activationFor: (ownerId: string) => Promise<CanonicalActivationReceipt | null> = id => getCanonicalActivation(id, db),
): Promise<boolean> => !!await getCanonicalCaptureFlag(ownerId, db) && !!await activationFor(ownerId);

/** Internal/test activation only. No product screen calls this in Phase 2. */
export const enableCanonicalCaptureForTestOwner = async (
  ownerId: string,
  db: ChronicleDB = localDB,
  activationFor: (ownerId: string) => Promise<CanonicalActivationReceipt | null> = id => getCanonicalActivation(id, db),
  clock: () => string = () => new Date().toISOString(),
): Promise<CanonicalCaptureFlag> => {
  if (!await activationFor(ownerId)) {
    throw new CanonicalCaptureFlagBlockedError('Canonical Capture requires an audited activation receipt.');
  }
  const flag: CanonicalCaptureFlag = {
    version: CANONICAL_CAPTURE_FLAG_VERSION,
    owner_id: ownerId,
    enabled_at: clock(),
  };
  await db.meta.put({ key: canonicalCaptureFlagKey(ownerId), value: JSON.stringify(flag) });
  return flag;
};

export const disableCanonicalCapture = async (
  ownerId: string,
  db: ChronicleDB = localDB,
): Promise<void> => {
  await db.meta.delete(canonicalCaptureFlagKey(ownerId));
};
