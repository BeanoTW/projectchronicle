// Chronicle V2 (candidate). Evidence section: persisted voice record and attachments for a sealed record.
// Sealed evidence cannot be deleted or replaced here — it can only be excluded from the dossier.
import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v2DB, type V2Media } from '../db';
import {
  ACCEPT_ATTR, LIMITS, LIMITS_COPY, STORAGE_COPY, addMedia, attachmentType, fmtDateTime,
  formatBytes, formatDuration, logMediaEvent, typeLabel, validateFile, writeErrorMessage,
} from './media';
import { useBlobUrl } from './useBlobUrl';

const EvidenceRow = ({ m }: { m: V2Media }) => {
  const type = m.kind === 'voice' ? 'audio' : attachmentType(m.mime, m.name);
  const previewable = type === 'image' || type === 'audio' || type === 'video';
  const url = useBlobUrl(previewable ? m.blob : null);
  const [desc, setDesc] = useState(m.description ?? '');
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const saveDesc = async () => {
    try {
      await v2DB.media.update(m.id, { description: desc.trim() || null });
      await logMediaEvent(m, 'described', desc.trim() || null);
      setEditing(false);
      setErr(null);
    } catch (e) { setErr(writeErrorMessage(e)); }
  };

  const toggleExcluded = async () => {
    const next = !m.excluded_from_dossier;
    try {
      await v2DB.media.update(m.id, { excluded_from_dossier: next });
      await logMediaEvent(m, next ? 'excluded' : 'included');
    } catch (e) { setErr(writeErrorMessage(e)); }
  };

  const openFile = () => {
    const u = URL.createObjectURL(m.blob);
    window.open(u, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  };

  return (
    <div className="proto-att-row" data-later={m.role === 'later' || undefined}>
      <div className="proto-att-top">
        {type === 'image' && url
          ? <img className="proto-att-thumb" src={url} alt={m.description ?? m.name} />
          : <span className="proto-att-badge">{m.kind === 'voice' ? 'Voice' : typeLabel[type]}</span>}
        <div className="proto-att-info">
          <span className="proto-att-name" title={m.name}>{m.name}</span>
          <span className="proto-help">
            {m.kind === 'voice' ? 'Voice record' : typeLabel[type]} · {formatBytes(m.size)}
            {m.duration_ms ? ` · ${formatDuration(m.duration_ms)}` : ''}
          </span>
          <span className="proto-help">Added {fmtDateTime(m.added_at)}</span>
        </div>
      </div>

      <div className="proto-chipwrap" style={{ marginTop: 2 }}>
        <span className="proto-chip" data-tone={m.role === 'original' ? undefined : 'brass'}>
          {m.role === 'original' ? 'Present when sealed' : 'Added after sealing'}
        </span>
        {m.excluded_from_dossier && <span className="proto-chip">Excluded from dossier</span>}
      </div>

      {(type === 'audio' || m.kind === 'voice') && url && (
        <audio className="proto-audio" controls src={url} preload="metadata" />
      )}
      {type === 'video' && url && <video className="proto-video" controls src={url} preload="metadata" />}

      {m.description && !editing && <p className="proto-att-desc">{m.description}</p>}

      {editing ? (
        <div>
          <input className="proto-input" value={desc} autoFocus
            placeholder="Short description" onChange={e => setDesc(e.target.value)} />
          <div className="proto-actions-row" style={{ marginTop: 6 }}>
            <button className="proto-btn" data-variant="ghost" onClick={() => { setDesc(m.description ?? ''); setEditing(false); }}>Cancel</button>
            <button className="proto-btn" data-variant="primary" onClick={saveDesc}>Save description</button>
          </div>
        </div>
      ) : (
        <div className="proto-actions-row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          <button className="proto-btn" data-variant="ghost" style={{ minHeight: 32, padding: '4px 10px' }}
            onClick={() => setEditing(true)}>
            {m.description ? 'Edit description' : 'Add description'}
          </button>
          {type !== 'image' && type !== 'audio' && (
            <button className="proto-btn" data-variant="ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={openFile}>
              Open file
            </button>
          )}
          <button className="proto-btn" data-variant="ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={toggleExcluded}>
            {m.excluded_from_dossier ? 'Include in dossier' : 'Exclude from dossier'}
          </button>
        </div>
      )}

      {err && <p className="proto-media-error">{err}</p>}
    </div>
  );
};

const EvidenceSection = ({ entryId }: { entryId: string }) => {
  const rows = useLiveQuery(
    () => v2DB.media.where('entry_id').equals(entryId).toArray(),
    [entryId],
    [] as V2Media[],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => {
      if (a.role !== b.role) return a.role === 'original' ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === 'voice' ? -1 : 1;
      return a.added_at.localeCompare(b.added_at);
    }),
    [rows],
  );

  const attachmentCount = rows.filter(r => r.kind === 'attachment').length;
  const full = attachmentCount >= LIMITS.MAX_ATTACHMENTS_PER_RECORD;

  const accept = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    const problems: string[] = [];
    let count = attachmentCount;
    for (const f of Array.from(list)) {
      const err = validateFile(f, count);
      if (err) { problems.push(err); continue; }
      try {
        await addMedia({
          entry_id: entryId, kind: 'attachment', role: 'later',
          name: f.name, mime: f.type || 'application/octet-stream', blob: f,
        });
        count += 1;
      } catch (e) {
        problems.push(`“${f.name}” — ${writeErrorMessage(e)}`);
      }
    }
    setErrors(problems);
    setBusy(false);
  };

  const original = sorted.filter(m => m.role === 'original');
  const later = sorted.filter(m => m.role === 'later');

  return (
    <section style={{ marginTop: 20 }}>
      <h2 className="proto-h2">Evidence</h2>
      <p className="proto-help" style={{ marginBottom: 10 }}>
        Voice records and files kept with this record. Evidence present when the record was sealed
        is shown first. Anything added later is marked as a later addition.
      </p>

      {sorted.length === 0 && <div className="proto-empty">No voice record or attachments.</div>}

      {original.length > 0 && (
        <>
          <p className="proto-flabel">Present when sealed</p>
          {original.map(m => <EvidenceRow key={m.id} m={m} />)}
        </>
      )}

      {later.length > 0 && (
        <>
          <p className="proto-flabel" style={{ marginTop: 12 }}>Added after sealing</p>
          {later.map(m => <EvidenceRow key={m.id} m={m} />)}
        </>
      )}

      <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTR}
        style={{ display: 'none' }} onChange={e => { accept(e.target.files); e.target.value = ''; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={e => { accept(e.target.files); e.target.value = ''; }} />

      <div className="proto-actions-row" style={{ flexWrap: 'wrap', marginTop: 12 }}>
        <button className="proto-btn" disabled={full || busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Saving…' : 'Add attachment'}
        </button>
        <button className="proto-btn" disabled={full || busy} onClick={() => cameraRef.current?.click()}>
          Photo
        </button>
      </div>

      {errors.map(e => <p key={e} className="proto-media-error">{e}</p>)}

      <p className="proto-help" style={{ marginTop: 8 }}>
        {LIMITS_COPY} Adding a file now does not make it part of the original sealed record.
        Sealed evidence cannot be removed or replaced here; exclude it from the dossier instead.
      </p>
      <p className="proto-help" style={{ marginTop: 6 }}>{STORAGE_COPY}</p>
    </section>
  );
};

export default EvidenceSection;
