import { format, parseISO } from 'date-fns';

interface IntegrityFooterProps {
  createdAt: string;
  originalCreatedAt?: string | null;
  lastModifiedAt?: string | null;
  updatedAt?: string;
  version?: number | null;
  className?: string;
}

function fmt(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'd MMM yyyy');
  } catch {
    return dateStr;
  }
}

/**
 * Single neutral line surfacing the DB-enforced lifecycle of a record.
 * Format: Created [date] · Last modified [date or "—"] · v[version]
 */
const IntegrityFooter = ({
  createdAt,
  originalCreatedAt,
  lastModifiedAt,
  updatedAt,
  version,
  className = '',
}: IntegrityFooterProps) => {
  const created = originalCreatedAt || createdAt;
  const last = lastModifiedAt || updatedAt;
  const hasMod =
    !!last && !!created && new Date(last).getTime() - new Date(created).getTime() > 1000;

  return (
    <p className={`text-[10px] text-muted-foreground/60 leading-relaxed ${className}`}>
      Created {fmt(created)}
      {' · '}
      Last modified {hasMod ? fmt(last as string) : '—'}
      {typeof version === 'number' && (
        <>
          {' · '}v{version}
        </>
      )}
    </p>
  );
};

export default IntegrityFooter;
