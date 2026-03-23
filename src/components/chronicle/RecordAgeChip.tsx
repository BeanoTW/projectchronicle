import { differenceInDays, parseISO } from 'date-fns';

interface RecordAgeChipProps {
  incidentDate: string;
  createdAt: string;
}

const RecordAgeChip = ({ incidentDate, createdAt }: RecordAgeChipProps) => {
  const daysGap = differenceInDays(parseISO(createdAt), parseISO(incidentDate));

  let text: string;
  let colorClass: string;

  if (daysGap === 0) {
    text = 'Recorded same day';
    colorClass = 'text-severity-low bg-severity-low/10';
  } else if (daysGap <= 2) {
    text = `Recorded ${daysGap} day${daysGap > 1 ? 's' : ''} after`;
    colorClass = 'text-severity-low bg-severity-low/10';
  } else if (daysGap <= 7) {
    text = `Recorded ${daysGap} days after`;
    colorClass = 'text-severity-serious bg-severity-serious/10';
  } else if (daysGap <= 30) {
    text = `Recorded ${daysGap} days after`;
    colorClass = 'text-muted-foreground bg-muted';
  } else {
    text = 'Added later';
    colorClass = 'text-muted-foreground bg-muted';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${colorClass}`}>
      {text}
    </span>
  );
};

export default RecordAgeChip;
