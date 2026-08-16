/**
 * Safe user-facing messages for attachment failures.
 *
 * Production users must never see internal table names, constraint names or
 * raw backend errors. Every attachment failure is mapped to one of a small set
 * of calm, honest messages here; the underlying detail is kept for developer
 * logging only (and never includes record content).
 */

export interface UserSafeError extends Error {
  userSafe?: true;
  /** Stable machine code for logging/tests. */
  code?: string;
}

/** Marks an error as already carrying a message that is safe to display. */
export const markUserSafe = <T extends Error>(error: T, code?: string): T & UserSafeError => {
  (error as T & UserSafeError).userSafe = true;
  if (code) (error as T & UserSafeError).code = code;
  return error as T & UserSafeError;
};

export const EVIDENCE_MESSAGES = {
  generic: "We couldn't save this attachment yet. Your record is safe. Please try again.",
  offline: 'This device is offline, so the attachment could not be saved yet. Your record is safe — try again when you are back online.',
  notReady: "We couldn't save this attachment yet because the record is still being prepared. Your record is safe. Please try again in a moment.",
  signedOut: 'Please sign in again to save this attachment. Your record is safe.',
} as const;

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** True when the raw error text looks like backend/database internals. */
const looksInternal = (msg: string) =>
  /constraint|violates|foreign key|relation |column |row-level security|rls|pgrst|jwt|supabase|duplicate key|sql/i.test(msg);

/**
 * Maps any thrown value to a message that is safe to show a user.
 * Validation messages produced by the upload policy are passed through
 * unchanged because they are already user-facing and specific.
 */
export const toSafeAttachmentMessage = (error: unknown): string => {
  const err = error as UserSafeError | undefined;
  const raw = typeof err?.message === 'string' ? err.message : '';

  if (isOffline()) return EVIDENCE_MESSAGES.offline;
  if (err?.code === 'incident_not_synced') return EVIDENCE_MESSAGES.notReady;
  if (err?.code === 'not_authenticated' || /not authenticated|not signed in/i.test(raw)) {
    return EVIDENCE_MESSAGES.signedOut;
  }
  if (err?.userSafe && raw && !looksInternal(raw)) return raw;
  if (raw && !looksInternal(raw) && raw.length <= 200 && /[.!?]$/.test(raw)) return raw;
  return EVIDENCE_MESSAGES.generic;
};

/**
 * Developer-only diagnostics. Logs the technical detail in development so the
 * cause is still findable, without ever printing record content.
 */
export const logAttachmentDiagnostic = (context: string, error: unknown): void => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) return;
  const raw = (error as Error)?.message ?? String(error);
  // eslint-disable-next-line no-console
  console.warn(`[attachments] ${context}: ${raw}`);
};
