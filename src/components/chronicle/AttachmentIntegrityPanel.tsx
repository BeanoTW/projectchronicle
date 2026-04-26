/**
 * Attachment integrity panel.
 *
 * Surfaces the SHA-256 fingerprint and timestamps Chronicle records when an
 * attachment is added. Wording is intentionally neutral: this is NOT a
 * forensic chain of custody, NOT independent legal verification, and NOT
 * proof of authenticity — it is a visible audit reference the user can
 * compare against later.
 *
 * Includes a local "Verify file integrity" action: the user picks a file
 * from their device, the file is hashed in-browser via the same utility
 * used at upload time, and the result is compared to the stored hash.
 * The selected verification file is NEVER uploaded.
 */
import { useRef, useState } from 'react';
import { Copy, ShieldCheck, ShieldOff, FileCheck2, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { computeSha256 } from '@/lib/attachments/integrity';

interface AttachmentIntegrityPanelProps {
  fileHash: string | null;
  captureDate: string | null;
  uploadDate: string | null;
  incidentId: string | null;
}

type VerifyState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'match'; computed: string }
  | { status: 'mismatch'; computed: string }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

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
  const [verify, setVerify] = useState<VerifyState>({ status: 'idle' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasHash = !!fileHash;

  const copyHash = async () => {
    if (!fileHash) return;
    try {
      await navigator.clipboard.writeText(fileHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const startVerify = () => {
    if (!hasHash) {
      setVerify({ status: 'unavailable' });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleVerifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset value so the same file can be re-selected if needed.
    e.target.value = '';
    if (!file) return;
    if (!fileHash) {
      setVerify({ status: 'unavailable' });
      return;
    }
    setVerify({ status: 'checking' });
    try {
      const computed = await computeSha256(file);
      const match = computed.toLowerCase() === fileHash.toLowerCase();
      setVerify(match ? { status: 'match', computed } : { status: 'mismatch', computed });
    } catch (err) {
      setVerify({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not read the selected file.',
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-left">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">Attachment integrity</p>
        {hasHash ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/[0.08] border border-primary/20 px-2 py-0.5 rounded-full">
            <ShieldCheck className="h-3 w-3" /> Fingerprint recorded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 border border-border px-2 py-0.5 rounded-full">
            <ShieldOff className="h-3 w-3" /> No fingerprint recorded
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Chronicle records a SHA-256 fingerprint when an attachment is added. This fingerprint can help confirm whether a file matches the version recorded by Chronicle. It does not prove where the file came from or establish a chain of custody.
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

      {/* Verify file integrity */}
      <div className="pt-2 border-t border-border space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-foreground">Verify file integrity</p>
          <button
            type="button"
            onClick={startVerify}
            disabled={verify.status === 'checking'}
            className="inline-flex items-center gap-1.5 text-[11px] text-primary border border-primary/30 bg-primary/[0.05] hover:bg-primary/10 rounded-md px-2.5 py-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {verify.status === 'checking' ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Checking…</>
            ) : (
              <><FileCheck2 className="h-3 w-3" /> Choose file to verify</>
            )}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Pick a copy of this file from your device. Chronicle will calculate its SHA-256
          fingerprint locally and compare it to the stored fingerprint. The selected file is
          not uploaded.
        </p>

        {verify.status === 'match' && (
          <div className="flex items-start gap-2 text-[11px] text-foreground bg-primary/[0.06] border border-primary/20 rounded-md p-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
            <span>The selected file matches the stored SHA-256 fingerprint.</span>
          </div>
        )}
        {verify.status === 'mismatch' && (
          <div className="flex items-start gap-2 text-[11px] text-foreground bg-muted border border-border rounded-md p-2">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>The selected file does not match the stored SHA-256 fingerprint.</span>
          </div>
        )}
        {verify.status === 'unavailable' && (
          <div className="flex items-start gap-2 text-[11px] text-foreground bg-muted border border-border rounded-md p-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>This attachment does not have a stored SHA-256 fingerprint, so it cannot be verified.</span>
          </div>
        )}
        {verify.status === 'error' && (
          <div className="flex items-start gap-2 text-[11px] text-foreground bg-muted border border-border rounded-md p-2">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>Could not check the file. {verify.message}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleVerifyFile}
        />
      </div>
    </div>
  );
};

export default AttachmentIntegrityPanel;
