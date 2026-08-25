import { useMemo, useState } from 'react';
import { structureSuggestions } from './inputHelper';

interface Props {
  text: string;
  onAccept: (text: string) => void;
  onShown: () => void;
  onInteract: () => void;
}

const InputHelperPanel = ({ text, onAccept, onShown, onInteract }: Props) => {
  const suggestions = useMemo(() => structureSuggestions(text), [text]);
  const [open, setOpen] = useState(false);
  if (!suggestions.length) return null;

  const show = () => {
    setOpen(true);
    onShown();
  };

  return (
    <div className="proto-media-box" aria-label="Structure assistance" style={{ marginTop: 10 }}>
      <div className="proto-media-head">Need help organising this?</div>
      <p className="proto-help" style={{ margin: '4px 0 8px' }}>
        Optional. Chronicle can suggest spacing and paragraph structure using only what you already wrote. It does not decide what happened or add facts.
      </p>
      {!open ? (
        <button className="proto-btn" data-variant="ghost" type="button" onClick={show}>Show structure suggestion</button>
      ) : (
        <div>
          {suggestions.map(suggestion => (
            <div key={suggestion.id} style={{ marginTop: 8 }}>
              <div className="proto-sealed-note" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>
                {suggestion.text}
              </div>
              <div className="proto-actions-row" style={{ marginTop: 6 }}>
                <button className="proto-btn" type="button" onClick={() => { onInteract(); onAccept(suggestion.text); }}>
                  Use this structure
                </button>
                <button className="proto-btn" data-variant="ghost" type="button" onClick={() => { onInteract(); setOpen(false); }}>
                  Keep my wording as-is
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InputHelperPanel;
