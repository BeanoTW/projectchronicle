import { useState } from 'react';
import { Lock, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface IntegrityPanelProps {
  narrative: string;
  savedAt: string;
}

const IntegrityPanel = ({ narrative, savedAt }: IntegrityPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const date = parseISO(savedAt);

  return (
    <div className="rounded-2xl border-2 bg-integrity border-integrity-border shadow-[0_4px_20px_-4px_hsl(145_79%_90%/0.5)]">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full text-left p-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-integrity-foreground/10 flex items-center justify-center flex-shrink-0">
            <Lock className="h-4 w-4 text-integrity-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-integrity-foreground leading-snug">
              Original content is preserved
            </p>
            <p className="text-[11px] text-integrity-foreground/70">
              Recorded on {format(date, 'dd MMMM yyyy')} at {format(date, 'HH:mm')} · Changes are recorded as updates
            </p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-integrity-foreground/50 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-integrity-foreground/60 mb-2">
            This record is preserved exactly as you originally wrote it.
          </p>
          <div className="bg-white/70 rounded-xl p-4">
            <p className="text-[14px] text-integrity-foreground leading-relaxed whitespace-pre-wrap">
              {narrative}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrityPanel;
