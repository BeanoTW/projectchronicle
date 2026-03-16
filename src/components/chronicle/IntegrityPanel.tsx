import { Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface IntegrityPanelProps {
  narrative: string;
  savedAt: string;
}

const IntegrityPanel = ({ narrative, savedAt }: IntegrityPanelProps) => {
  const date = parseISO(savedAt);

  return (
    <div className="rounded-lg border bg-integrity border-integrity-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="h-4 w-4 text-integrity-foreground" />
        <span className="text-sm font-semibold text-integrity-foreground">
          Original Record — Preserved Exactly As Written
        </span>
      </div>
      <p className="text-xs text-integrity-foreground mb-3">
        Saved: {format(date, 'dd MMMM yyyy')} at {format(date, 'HH:mm')}
      </p>
      <p className="text-xs text-integrity-foreground mb-3">
        This record is preserved exactly as you originally wrote it. It cannot be edited.
      </p>
      <div className="bg-white/60 rounded-md p-3">
        <p className="text-sm text-integrity-foreground leading-relaxed whitespace-pre-wrap">
          {narrative}
        </p>
      </div>
    </div>
  );
};

export default IntegrityPanel;
