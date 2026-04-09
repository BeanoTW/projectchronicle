import { differenceInDays, parseISO, format } from 'date-fns';

interface RecordAgeChipProps {
  incidentDate: string;
  createdAt: string;
}

const RecordAgeChip = ({ incidentDate, createdAt }: RecordAgeChipProps) => {
  const created = parseISO(createdAt);
  const daysGap = differenceInDays(created, parseISO(incidentDate));

  const recordedLine = `Recorded on ${format(created, 'dd MMMM yyyy')} at ${format(created, 'HH:mm')}`;

  let secondaryLine: string | null = null;
  if (daysGap > 0) {
    secondaryLine = `Recorded ${daysGap} day${daysGap !== 1 ? 's' : ''} after incident`;
  }

  const colorClass = daysGap <= 2
    ? 'text-severity-low bg-severity-low/10'
    : daysGap <= 7
      ? 'text-severity-serious bg-severity-serious/10'
      : 'text-muted-foreground bg-muted';

  return (
    <span className={`inline-flex flex-col px-2.5 py-1 rounded-lg text-[11px] font-medium leading-snug ${colorClass}`}>
      <span>{recordedLine}</span>
      {secondaryLine && <span className="opacity-70">{secondaryLine}</span>}
    </span>
  );
};

export default RecordAgeChip;
