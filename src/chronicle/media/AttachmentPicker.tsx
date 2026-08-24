// Chronicle V2 (candidate). staging list for attachments added before a record is sealed.
import { useRef, useState } from 'react';
import { ACCEPT_ATTR, LIMITS, LIMITS_COPY, attachmentType, formatBytes, typeLabel, validateFile, type PendingFile } from './mediaCore';
import { useBlobUrl } from './useBlobUrl';

const PendingRow = ({ file, onDescribe, onRemove }: { file: PendingFile; onDescribe: (v: string) => void; onRemove: () => void }) => {
  const type = attachmentType(file.mime, file.name);
  const url = useBlobUrl(type === 'image' ? file.blob : null);
  return <div className="proto-att-row"><div className="proto-att-top">
    {url ? <img className="proto-att-thumb" src={url} alt="" /> : <span className="proto-att-badge">{typeLabel[type]}</span>}
    <div className="proto-att-info"><span className="proto-att-name" title={file.name}>{file.name}</span><span className="proto-help">{typeLabel[type]} · {formatBytes(file.size)}</span></div>
    <button type="button" className="proto-btn" data-variant="ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={onRemove}>Remove</button>
  </div><input className="proto-input" placeholder="Short description (optional)" value={file.description} onChange={e => onDescribe(e.target.value)} /></div>;
};

interface Props { files: PendingFile[]; onChange: (files: PendingFile[]) => void; }
const AttachmentPicker = ({ files, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const accept = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files]; const problems: string[] = [];
    Array.from(list).forEach(f => {
      const err = validateFile(f, next.length); if (err) { problems.push(err); return; }
      next.push({ id: crypto.randomUUID(), name: f.name, mime: f.type || 'application/octet-stream', size: f.size, description: '', blob: f });
    });
    setErrors(problems); onChange(next);
  };
  const full = files.length >= LIMITS.MAX_ATTACHMENTS_PER_RECORD;
  return <div className="proto-media-box"><div className="proto-media-head"><span>Supporting attachments</span><span className="proto-help">{files.length}/{LIMITS.MAX_ATTACHMENTS_PER_RECORD}</span></div>
    <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTR} style={{ display: 'none' }} onChange={e => { accept(e.target.files); e.target.value = ''; }} />
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { accept(e.target.files); e.target.value = ''; }} />
    <div className="proto-actions-row" style={{ flexWrap: 'wrap' }}><button type="button" className="proto-btn" disabled={full} onClick={() => inputRef.current?.click()}>Add files</button><button type="button" className="proto-btn" disabled={full} onClick={() => cameraRef.current?.click()}>Photo</button></div>
    {files.map(f => <PendingRow key={f.id} file={f} onDescribe={v => onChange(files.map(x => x.id === f.id ? { ...x, description: v } : x))} onRemove={() => onChange(files.filter(x => x.id !== f.id))} />)}
    {errors.map(e => <p key={e} className="proto-media-error">{e}</p>)}
    <p className="proto-help" style={{ marginTop: 8 }}>{LIMITS_COPY} Attachments added now stay with the record when it is sealed.</p>
  </div>;
};
export default AttachmentPicker;
