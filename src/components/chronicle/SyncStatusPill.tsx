import { formatDistanceToNow } from 'date-fns';

interface SyncStatusPillProps {
  state: 'local_only' | 'backed_up' | 'conflict';
  lastBackupAt?: string | null;
  conflictCount?: number;
  onClick?: () => void;
}

/**
 * Single, calm pill summarising sync state. Three states only.
 */
const SyncStatusPill = ({
  state,
  lastBackupAt,
  conflictCount = 0,
  onClick,
}: SyncStatusPillProps) => {
  let label = 'Local only';
  if (state === 'backed_up') {
    if (lastBackupAt) {
      try {
        label = `Backed up · ${formatDistanceToNow(new Date(lastBackupAt), { addSuffix: true })}`;
      } catch {
        label = 'Backed up';
      }
    } else {
      label = 'Backed up';
    }
  } else if (state === 'conflict') {
    label = `Conflict on ${conflictCount} record${conflictCount === 1 ? '' : 's'}`;
  }

  const base =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors';
  const tone =
    state === 'conflict'
      ? 'bg-muted text-foreground border-border'
      : state === 'backed_up'
        ? 'bg-primary/[0.06] text-primary border-primary/15'
        : 'bg-muted/50 text-muted-foreground border-border';

  const Dot = (
    <span
      className={`w-1.5 h-1.5 rounded-full ${
        state === 'backed_up'
          ? 'bg-primary/70'
          : state === 'conflict'
            ? 'bg-muted-foreground'
            : 'bg-muted-foreground/50'
      }`}
    />
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} ${tone} hover:opacity-90 active:scale-[0.97]`}>
        {Dot}
        {label}
      </button>
    );
  }
  return (
    <span className={`${base} ${tone}`}>
      {Dot}
      {label}
    </span>
  );
};

export default SyncStatusPill;
