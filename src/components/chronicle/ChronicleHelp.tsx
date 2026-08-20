// Permanent, unobtrusive Chronicle help control.
//
// Secondary to report and export actions: a quiet text button that reveals a
// concise explanation and offers a replay of the Chronicle walkthrough.
import { useState } from 'react';
import { CHRONICLE_HELP_TEXT } from '@/chronicle/guidance/tours';
import '@/chronicle/styles.css';

interface Props {
  onReplay: () => void;
}

const ChronicleHelp = ({ onReplay }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="proto-helpblock proto-noprint" data-testid="chronicle-help">
      <button
        type="button"
        className="proto-helplink"
        aria-expanded={open}
        aria-controls="chronicle-help-panel"
        data-testid="chronicle-help-toggle"
        onClick={() => setOpen(o => !o)}
      >
        <span aria-hidden>?</span> How Chronicle works
      </button>

      {open && (
        <div className="proto-helppanel" id="chronicle-help-panel" data-testid="chronicle-help-panel">
          <ul className="proto-helplist">
            {CHRONICLE_HELP_TEXT.map(line => <li key={line}>{line}</li>)}
          </ul>
          <button
            type="button"
            className="proto-btn"
            data-testid="chronicle-help-replay"
            onClick={() => { setOpen(false); onReplay(); }}
          >
            Show me around Chronicle
          </button>
        </div>
      )}
    </div>
  );
};

export default ChronicleHelp;
