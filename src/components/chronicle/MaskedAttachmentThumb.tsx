/**
 * MaskedAttachmentThumb — neutral locked placeholder shown in place of an
 * attachment thumbnail while the Privacy Shield reveal gate is active.
 *
 * Intentionally does NOT load the underlying file, so the real image bytes
 * never enter the DOM until the user successfully re-auths.
 */
import { FileLock2 } from 'lucide-react';

interface MaskedAttachmentThumbProps {
  onUnlock: () => void;
  /** Compact = small inline thumb (square). Otherwise a wider list cell. */
  variant?: 'compact' | 'inline';
  className?: string;
}

const MaskedAttachmentThumb = ({ onUnlock, variant = 'compact', className }: MaskedAttachmentThumbProps) => {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onUnlock}
        aria-label="Attachment hidden — unlock to view"
        className={`w-full h-full flex flex-col items-center justify-center gap-0.5 bg-muted/40 border border-dashed border-border rounded-lg text-muted-foreground active:scale-[0.97] transition-transform ${className ?? ''}`}
      >
        <FileLock2 className="h-4 w-4" />
        <span className="text-[9px] leading-none">Hidden</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onUnlock}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-muted/30 text-left active:scale-[0.99] transition-transform ${className ?? ''}`}
    >
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        <FileLock2 className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground">Attachment hidden</p>
        <p className="text-[11px] text-primary/80">Unlock to view</p>
      </div>
    </button>
  );
};

export default MaskedAttachmentThumb;
