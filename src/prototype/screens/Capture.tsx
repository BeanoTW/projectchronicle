import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { protoDB, type PrototypeEntry } from '../db';

const DRAFT_KEY = 'proto.capture.draft';

const CaptureScreen = () => {
  const navigate = useNavigate();
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
  });
  const [sealed, setSealed] = useState<PrototypeEntry | null>(null);
  const capturedAt = useRef(new Date().toISOString());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sealed) textareaRef.current?.focus();
  }, [sealed]);

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, text); } catch { /* ignore */ }
  }, [text]);

  const seal = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const entry: PrototypeEntry = {
      id: `proto-${crypto.randomUUID()}`,
      original_text: trimmed,
      sealed_at: now,
      captured_at: capturedAt.current,
      category: null,
      context: null,
      people: [],
      event_date: now.slice(0, 10),
      event_time: null,
      clarifications: [],
      in_dossier: false,
      title: null,
    };
    await protoDB.entries.put(entry);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setSealed(entry);
  };

  if (sealed) {
    return (
      <div>
        <h1 className="proto-h1">Record sealed.</h1>
        <div className="proto-sealed-note">
          <div style={{ fontSize: 12, color: 'var(--p-muted)', marginBottom: 4 }}>
            Sealed {new Date(sealed.sealed_at).toLocaleString()}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>
            {sealed.original_text}
          </div>
        </div>
        <p className="proto-help" style={{ marginBottom: 12 }}>
          Sealing preserves your original wording and timestamp. You can add details now
          or later — the original text will not change.
        </p>
        <div className="proto-actions-row">
          <button
            className="proto-btn"
            data-variant="primary"
            onClick={() => navigate(`/prototype/review/${sealed.id}`)}
          >
            Add details
          </button>
          <button
            className="proto-btn"
            onClick={() => navigate('/prototype/notebook')}
          >
            Finish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="proto-h1">Capture</h1>
      <p className="proto-help" style={{ marginBottom: 12 }}>
        Write freely. You do not need a title, category or date. Chronicle will note the
        time you sealed it.
      </p>
      <textarea
        ref={textareaRef}
        className="proto-textarea"
        placeholder="What happened?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="proto-btn"
          data-variant="primary"
          onClick={seal}
          disabled={!text.trim()}
          style={{ flex: 1 }}
        >
          Seal record
        </button>
        <button
          className="proto-btn"
          disabled
          title="Voice capture not implemented in prototype"
          aria-label="Voice capture (not implemented)"
        >
          🎙 Voice (soon)
        </button>
      </div>
      <p className="proto-help" style={{ marginTop: 10, fontSize: 12 }}>
        Sealing preserves your original wording and timestamp.{' '}
        <button
          type="button"
          onClick={() => alert(
            'What is stored:\n• Your exact wording, unchanged\n• The timestamp you sealed it\n\n' +
            'Clarifications later:\n• Added as separate, timestamped blocks\n• Do not alter the original\n\n' +
            'What Chronicle tracks: dates, edits, dossier inclusion.\n' +
            'What it does not: independently certify what happened.'
          )}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--p-brass)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
        >
          Learn more
        </button>
      </p>
    </div>
  );
};

export default CaptureScreen;
