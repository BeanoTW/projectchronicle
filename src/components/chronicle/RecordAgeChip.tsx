import { differenceInDays, differenceInHours, parseISO, format } from 'date-fns';

interface RecordAgeChipProps {
  incidentDate: string;
  createdAt: string;
}

/**
 * Retrospective recording indicator.
 * - Hidden if gap < 1 hour (same-moment entries — no noise)
 * - Slightly more prominent if gap ≥ 24 hours (meaningful delay)
 */
const RecordAgeChip = ({ incidentDate, createdAt }: RecordAgeChipProps) => {
  const created = parseISO(createdAt);
  const incident = parseISO(incidentDate);
  const hoursGap = differenceInHours(created, incident);

  // Hide entirely when the gap is below 1 hour
  if (hoursGap < 1) return null;

  const daysGap = differenceInDays(created, incident);
  const recordedLine = `Recorded on ${format(created, 'dd MMMM yyyy')} at ${format(created, 'HH:mm')}`;

  let secondaryLine: string | null = null;
  if (daysGap > 0) {
    secondaryLine = `Recorded ${daysGap} day${daysGap !== 1 ? 's' : ''} after incident`;
  }

  const isMeaningfulDelay = daysGap >= 1; // ≥24h

  // Neutral, non-severity styling. Recording-time gap is informational, not a severity signal.
  const colorClass = 'text-muted-foreground bg-muted';

  // Slight prominence bump for meaningful delays only (size + weight, no colour change)
  const sizeClass = isMeaningfulDelay
    ? 'text-[12px] px-3 py-1.5 font-semibold'
    : 'text-[11px] px-2.5 py-1 font-medium';

  return (
    <span className={`inline-flex flex-col rounded-lg leading-snug ${sizeClass} ${colorClass}`}>
      <span>{recordedLine}</span>
      {secondaryLine && <span className="opacity-70 font-medium">{secondaryLine}</span>}
    </span>
  );
};

export default RecordAgeChip;
