// The Chronicle seal: the one visual that says "this wording is now fixed".
//
// Shown once, animated, straight after sealing, and statically on every record
// afterwards so the two moments look the same. It states facts only: when the
// record was sealed and, where the source provides it, its provenance.
import type { ReactNode } from 'react';

export interface SealedReceiptProps {
  /** ISO timestamp the record was sealed. */
  sealedAt: string;
  /** Canonical integrity/provenance line, when the source exposes one. */
  provenance?: string;
  /** Extra status line, e.g. saved on this device / backed up. */
  status?: ReactNode;
  /** Play the seal animation (use only at the moment of sealing). */
  animate?: boolean;
  title?: string;
}

export const formatSealedAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
};

const SealedReceipt = ({ sealedAt, provenance, status, animate = false, title = 'Sealed' }: SealedReceiptProps) => (
  <div className="proto-seal" data-animate={animate ? 'true' : undefined} data-testid="sealed-receipt">
    <svg className="proto-seal-mark" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle className="proto-seal-ring" cx="24" cy="24" r="21" />
      <circle className="proto-seal-fill" cx="24" cy="24" r="16" />
      <path className="proto-seal-check" d="M16.5 24.5l5 5 10-11" />
    </svg>
    <div className="proto-seal-copy">
      <div className="proto-seal-title">{title}</div>
      <div className="proto-seal-time">
        <time dateTime={sealedAt}>{formatSealedAt(sealedAt)}</time>
      </div>
      {provenance && <div className="proto-seal-prov">{provenance}</div>}
      {status && <div className="proto-seal-status">{status}</div>}
    </div>
  </div>
);

export default SealedReceipt;