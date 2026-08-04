import { V2_BASE } from '../routes';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v2DB, type V2Entry } from '../db';
import VoiceCapture, { type VoiceDraft } from '../media/VoiceCapture';
import AttachmentPicker from '../media/AttachmentPicker';
import { useDialogs } from '../components/Dialog';
import { STORAGE_COPY, addMedia, type PendingFile, writeErrorMessage } from '../media/media';

const DRAFT_KEY = 'proto.capture.draft';

const CaptureScreen = () => {
  const navigate = useNavigate();
  const dialogs = useDialogs();
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
  });
  const [voice, setVoice] = useState<VoiceDraft | null>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [recordingActive, setRecordingActive] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState<V2Entry | null>(null);
  const capturedAt = useRef(new Date().toISOString());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sealed) textareaRef.current?.focus();
  }, [sealed]);

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, text); } catch { /* ignore */ }
  }, [text]);

  /* Guard against accidental loss of an active recording or unsealed capture. */
  const dirty = !sealed && (recordingActive || !!voice || files.length > 0 || text.trim().length > 0);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const canSeal = !recordingActive && (text.trim().length > 0 || !!voice);

  const leave = async () => {
    if (dirty) {
      const ok = await dialogs.confirm({
        title: 'Leave this capture?',
        body: 'Anything written or recorded here has not been sealed yet and will be discarded.',
        confirmLabel: 'Discard and leave',
        cancelLabel: 'Keep writing',
        tone: 'danger',
      });
      if (!ok) return;
    }
    navigate(V2_BASE + '/notebook');
  };

  const seal = async () => {
    if (!canSeal || sealing) return;
    setSealing(true);
    setError(null);
    const now = new Date().toISOString();
    const entry: V2Entry = {
      id: `proto-${crypto.randomUUID()}`,
      original_text: text.trim(),
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
    try {
      await v2DB.entries.put(entry);
      if (voice) {
        await addMedia({
          entry_id: entry.id, kind: 'voice', role: 'original',
          name: `voice-record-${now.slice(0, 19).replace(/[:T]/g, '-')}.${voice.mime.includes('mp4') ? 'm4a' : 'webm'}`,
          mime: voice.mime, blob: voice.blob, duration_ms: voice.duration_ms, added_at: now,
        });
      }
      const failed: string[] = [];
      for (const f of files) {
        try {
          await addMedia({
            entry_id: entry.id, kind: 'attachment', role: 'original',
            name: f.name, mime: f.mime, blob: f.blob, description: f.description, added_at: now,
          });
        } catch (e) { failed.push(`“${f.name}” — ${writeErrorMessage(e)}`); }
      }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      if (failed.length) setError(`${failed.length} file${failed.length === 1 ? '' : 's'} could not be saved. The record itself was sealed. ${failed[0]}`);
      setSealed(entry);
    } catch (e) {
      setError(writeErrorMessage(e));
    } finally {
      setSealing(false);
    }
  };

  if (sealed) {
    return (
      <div>
        <h1 className="proto-h1">Record sealed.</h1>
        <div className="proto-sealed-note">
          <div style={{ fontSize: 12, color: 'var(--p-muted)', marginBottom: 4 }}>
            Sealed {new Date(sealed.sealed_at).toLocaleString()}
          </div>
          {sealed.original_text ? (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>
              {sealed.original_text}
            </div>
          ) : (
            <div className="proto-help" style={{ margin: 0 }}>Voice record only — no written wording.</div>
          )}
        </div>
        {error && <p className="proto-media-error">{error}</p>}
        <p className="proto-help" style={{ marginBottom: 12 }}>
          Sealing preserves your original wording, any voice record and the timestamp. You can add
          details or further evidence now or later — the originals will not change.
        </p>
        <div className="proto-actions-row">
          <button
            className="proto-btn"
            data-variant="primary"
            onClick={() => navigate(`${V2_BASE}/review/${sealed.id}`)}
          >
            Add details
          </button>
          <button
            className="proto-btn"
            onClick={() => navigate(`${V2_BASE}/entry/${sealed.id}`)}
          >
            Open record
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="proto-h1">Capture</h1>
      <p className="proto-help" style={{ marginBottom: 12 }}>
        Write freely, speak, or both. You do not need a title, category or date. Chronicle will note
        the time you sealed it.
      </p>

      <label className="proto-flabel" htmlFor="proto-written">Written record</label>
      <textarea
        id="proto-written"
        ref={textareaRef}
        className="proto-textarea"
        placeholder="What happened?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <VoiceCapture value={voice} onChange={setVoice} onActiveChange={setRecordingActive} />

      <AttachmentPicker files={files} onChange={setFiles} />

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          className="proto-btn"
          data-variant="primary"
          onClick={seal}
          disabled={!canSeal || sealing}
          style={{ flex: 1 }}
        >
          {sealing ? 'Sealing…' : 'Seal record'}
        </button>
        <button className="proto-btn" data-variant="ghost" onClick={leave}>Cancel</button>
      </div>

      {!canSeal && (
        <p className="proto-help" style={{ marginTop: 8 }}>
          {recordingActive
            ? 'Stop the recording before sealing.'
            : 'Add written wording or a voice record before sealing. Attachments alone are not a record.'}
        </p>
      )}
      {error && <p className="proto-media-error">{error}</p>}

      <p className="proto-help" style={{ marginTop: 10, fontSize: 12 }}>
        {STORAGE_COPY}{' '}
        <button
          type="button"
          onClick={() => dialogs.notice({
            title: 'What Chronicle stores',
            body:
              'Sealed and unchanged: your exact wording, any voice record, attachments added before sealing, and the time you sealed it. ' +
              'Clarifications and files added later are stored as separate, timestamped items and never alter the original. ' +
              'Chronicle records dates, additions and dossier inclusion. It does not transcribe, analyse or independently verify what happened or what a file contains.',
          })}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--p-brass)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
        >
          Learn more
        </button>
      </p>
    </div>
  );
};

export default CaptureScreen;
