/**
 * Neutral, non-destructive indicator that a record has a sync conflict.
 * Used on list/timeline cards. Tap behaviour is owned by the parent
 * (the card itself remains the tap target).
 */
const ConflictBadge = ({ className = '' }: { className?: string }) => (
  <span
    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border ${className}`}
    aria-label="Conflict detected"
  >
    Conflict detected
  </span>
);

export default ConflictBadge;
