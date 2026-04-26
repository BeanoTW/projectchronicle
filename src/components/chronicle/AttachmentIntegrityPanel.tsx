/**
 * Attachment integrity panel.
 *
 * Surfaces the hash + timestamps that Chronicle records when an attachment is
 * uploaded. Intentionally neutral — this is not legal verification, just a
 * visible audit trail the user can reference later.
 */
import { useState } from 'react';
import { Copy, ShieldCheck, ShieldOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AttachmentIntegrityPanelProps {
  fileHash: string | null;
  captureDate: string | null;
  uploadDate: string | null;
  incidentId: string | null;
}

function formatTs(ts: string | null): string {
  if (!ts) return '—';
  try { return format(parseISO(ts), 'd MMM yyyy, HH:mm'); } catch { return ts; }
}

const AttachmentIntegrityPanel = ({
  fileHash,
  captureDate,
  uploadDate,
  incidentId,
}: AttachmentIntegrityPanelProps) => {
  const [copied, setCopied] = useState(false);
  const hasHash = !!fileHash;

  const copyHash = async () => {
    if (!fileHash) return;
    try {
      await navigator.clipboard.writeText(fileHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-left">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">Attachment integrity</p>
        {hasHash ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/[0.08] border border-primary/20 px-2 py-0.5 rounded-full">
            <ShieldCheck className="h-3 w-3" /> Integrity stamp available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 border border-border px-2 py-0.5 rounded-full">
            <ShieldOff className="h-3 w-3" /> Integrity stamp unavailable
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        This information helps show when the attachment was added and whether the file has changed since it was recorded.
      </p>

      <dl className="space-y-2 text-[12px]">
        <div>
          <dt className="text-muted-foreground">SHA-256 fingerprint</dt>
          {hasHash ? (
            <dd className="mt-1 flex items-start gap-2">
              <code className="flex-1 font-mono text-[11px] text-foreground bg-muted/40 border border-border rounded-md px-2 py-1.5 break-all leading-snug">
                {fileHash}
              </code>
              <button
                type="button"
                onClick={copyHash}
                className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1.5 active:scale-[0.97] transition-transform"
              >
                <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
              </button>
            </dd>
          ) : (
            <dd className="mt-1 text-muted-foreground">Not recorded for this attachment.</dd>
          )}
        </div>

        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Capture / added</dt>
          <dd className="text-foreground tabular-nums">{formatTs(captureDate)}</dd>
        </div>

        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Uploaded</dt>
          <dd className="text-foreground tabular-nums">{formatTs(uploadDate)}</dd>
        </div>

        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Linked record ID</dt>
          <dd className="text-foreground font-mono text-[11px] break-all text-right">
            {incidentId ?? 'Not linked'}
          </dd>
        </div>
      </dl>
    </div>
  );
};

export default AttachmentIntegrityPanel;
