import { ChronicleDB, localDB, type LocalOwnerErasureReport } from '@/local/db';

const PENDING_ERASURE_KEY = 'chronicle.pendingLocalAccountErasure';
const PENDING_ERASURE_VERSION = 1;

interface PendingErasure {
  version: typeof PENDING_ERASURE_VERSION;
  owner_id: string;
}

const storage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** Call only after the server has confirmed that this account was deleted. */
export const markConfirmedLocalAccountErasure = (ownerId: string): void => {
  if (!ownerId) throw new Error('Owner id is required for account erasure.');
  const value: PendingErasure = { version: PENDING_ERASURE_VERSION, owner_id: ownerId };
  storage()?.setItem(PENDING_ERASURE_KEY, JSON.stringify(value));
};

export const clearConfirmedLocalAccountErasure = (): void => {
  try { storage()?.removeItem(PENDING_ERASURE_KEY); } catch { /* retry marker is best effort */ }
};

export const getConfirmedLocalAccountErasure = (): PendingErasure | null => {
  try {
    const raw = storage()?.getItem(PENDING_ERASURE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingErasure>;
    if (parsed.version !== PENDING_ERASURE_VERSION || typeof parsed.owner_id !== 'string' || !parsed.owner_id) return null;
    return parsed as PendingErasure;
  } catch {
    return null;
  }
};

/**
 * Erase a server-confirmed deleted account from this device. The marker is
 * cleared only after the owner-scoped IndexedDB transaction commits.
 */
export const eraseConfirmedLocalAccount = async (
  ownerId: string,
  db: ChronicleDB = localDB,
): Promise<LocalOwnerErasureReport> => {
  const report = await db.eraseOwnerData(ownerId);
  clearConfirmedLocalAccountErasure();
  return report;
};

/** Retry a confirmed erasure after an app/tab crash. Failure leaves the marker intact. */
export const recoverConfirmedLocalAccountErasure = async (
  db: ChronicleDB = localDB,
): Promise<boolean> => {
  const pending = getConfirmedLocalAccountErasure();
  if (!pending) return false;
  await db.eraseOwnerData(pending.owner_id);
  clearConfirmedLocalAccountErasure();
  return true;
};
