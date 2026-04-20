/**
 * ObscuredBlock — Detail-surface privacy obscuring.
 *
 * Renders its children with a blur overlay when Privacy Shield is active.
 * Layout, spacing and structure are preserved (no dot-replacement).
 *
 * Tap (or press-and-hold) reveals the content locally — the global Privacy
 * Shield state is NOT changed and no stored data is touched.
 */
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { cn } from '@/lib/utils';

interface ObscuredBlockProps {
  children: React.ReactNode;
  className?: string;
  /** Hint shown on the reveal affordance. Default: "Tap to reveal". */
  revealHint?: string;
}

const ObscuredBlock = ({ children, className, revealHint = 'Tap to reveal' }: ObscuredBlockProps) => {
  const { enabled } = usePrivacy();
  const [revealed, setRevealed] = useState(false);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const obscured = !revealed;

  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden={obscured}
        className={cn(
          'transition-[filter,opacity] duration-200 select-none',
          obscured && 'blur-md opacity-70 pointer-events-none'
        )}
      >
        {children}
      </div>

      {obscured && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex items-center justify-center"
          aria-label={revealHint}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur px-3 py-1.5 border border-border text-[11px] font-medium text-foreground shadow-sm">
            <EyeOff className="h-3 w-3" />
            {revealHint}
          </span>
        </button>
      )}

      {revealed && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Eye className="h-3 w-3" />
          Hide again
        </button>
      )}
    </div>
  );
};

export default ObscuredBlock;
