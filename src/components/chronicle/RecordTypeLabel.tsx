/**
 * Primary record-type label.
 * record_type is the PRIMARY identifier on every card/header.
 * Category (for incidents) is rendered separately as secondary metadata.
 */
interface Props {
  recordType?: string | null;
  size?: 'sm' | 'md';
}

const RecordTypeLabel = ({ recordType, size = 'sm' }: Props) => {
  const isDaily = recordType === 'daily_record';
  const text = isDaily ? 'Daily record' : 'Incident';
  const tone = isDaily
    ? 'bg-muted text-muted-foreground'
    : 'bg-primary/10 text-primary';
  const sizing = size === 'md'
    ? 'text-[11px] px-2 py-0.5'
    : 'text-[10px] px-1.5 py-0.5';

  return (
    <span className={`inline-block rounded font-semibold uppercase tracking-wide ${tone} ${sizing}`}>
      {text}
    </span>
  );
};

export default RecordTypeLabel;
