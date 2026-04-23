import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  body: string;
  /** Optional single, calm call-to-action. */
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ icon, heading, body, actionLabel, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="text-muted-foreground/40 mb-5">{icon}</div>
    <h3 className="text-[15px] font-semibold text-foreground mb-2">{heading}</h3>
    <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">{body}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center justify-center px-4 py-2 rounded-lg text-[13px] font-medium bg-primary/[0.06] text-primary border border-primary/20 hover:bg-primary/10 active:scale-[0.97] transition"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
