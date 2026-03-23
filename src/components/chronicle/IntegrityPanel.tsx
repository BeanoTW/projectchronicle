import { Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface IntegrityPanelProps {
  narrative: string;
  savedAt: string;
}

const IntegrityPanel = ({ narrative, savedAt }: IntegrityPanelProps) => {
  const date = parseISO(savedAt);

  return (
    <div className="rounded-2xl border-2 bg-integrity border-integrity-border p-5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-integrity-foreground/10 flex items-center justify-center">
          <Lock className="h-4 w-4 text-integrity-foreground" />
        </div>
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
      <div className="bg-white/70 rounded-xl p-4">
        <p className="text-[15px] text-integrity-foreground leading-relaxed whitespace-pre-wrap">
          {narrative}
        </p>
      </div>
    </div>
  );
};

export default IntegrityPanel;
