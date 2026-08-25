// Phase 6C — source-agnostic capture view.
// Persistence is entirely owned by the injected adapter. This file must not
// import Dexie, Supabase, or production hooks.
import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';
import { useEffect, useRef, useState } from 'react';
import VoiceCapture, { type VoiceDraft } from '../media/VoiceCapture';
import AttachmentPicker from '../media/AttachmentPicker';
import { useDialogs } from '../components/Dialog';
import { type PendingFile } from '../media/mediaCore';
import InputHelperPanel from './InputHelperPanel';
import { helperSealState } from './inputHelper';
import {
  canSealCapture, captureIsDirty, describeFailures,
  type CaptureRecordType,
  type CaptureAdapter, type CaptureMediaItem, type MediaFailure,
} from './captureModel';

interface Props { adapter: CaptureAdapter; onNavigate: (path: string) => void; notice?: string | null; }

const CaptureView = ({ adapter, onNavigate, notice }: Props) => {
  const dialogs = useDialogs();
  const { draftKey, capabilities } = adapter;
  const [text, setText] = useState(() => { try { return sessionStorage.getItem(draftKey) ?? ''; } catch { return ''; } });
  const [voice, setVoice] = useState<VoiceDraft | null>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [recordingActive, setRecordingActive] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState<{ id: string; sealedAt: string; text: string } | null>(null);
  const [failures, setFailures] = useState<MediaFailure[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [recordType, setRecordType] = useState<CaptureRecordType>('incident');
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [sealedOffline, setSealedOffline] = useState(false);
  const [helperShown, setHelperShown] = useState(false);
  const [helperInteracted, setHelperInteracted] = useState(false);
  const [acceptedSuggestionCount, setAcceptedSuggestionCount] = useState(0);

  const capturedAt = useRef(new Date().toISOString());
  const submissionId = useRef(crypto.randomUUID());
  const submittingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sealedHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => { if (!sealed) textareaRef.current?.focus(); else sealedHeadingRef.current?.focus(); }, [sealed]);
  useEffect(() => { try { sessionStorage.setItem(draftKey, text); } catch { /* ignore */ } }, [text, draftKey]);

  const dirty = captureIsDirty({ sealed: !!sealed, text, hasVoice: !!voice, attachmentCount: files.length, recordingActive });
  const hasUnsavedSealedMedia = !!sealed && failures.length > 0;
  useEffect(() => {
    if (!dirty && !hasUnsavedSealedMedia) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, hasUnsavedSealedMedia]);
  const canSeal = canSealCapture({ text, hasVoice: !!voice, recordingActive });

  const mediaItems = (): CaptureMediaItem[] => {
    const now = new Date().toISOString(); const items: CaptureMediaItem[] = [];
    if (voice && capabilities.voice) items.push({ id: `voice-${submissionId.current}`, kind: 'voice', name: `voice-record-${now.slice(0, 19).replace(/[:T]/g, '-')}.${voice.mime.includes('mp4') ? 'm4a' : 'webm'}`, mime: voice.mime, blob: voice.blob, duration_ms: voice.duration_ms });
    if (capabilities.attachments) files.forEach(f => items.push({ id: f.id, kind: 'attachment', name: f.name, mime: f.mime, blob: f.blob, description: f.description }));
    return items;
  };

  const leave = async () => {
    if (dirty) {
      const ok = await dialogs.confirm({ title: 'Leave this capture?', body: 'Anything written or recorded here has not been sealed yet and will be discarded.', confirmLabel: 'Discard and leave', cancelLabel: 'Keep writing', tone: 'danger' });
      if (!ok) return;
    }
    onNavigate(adapter.notebookPath);
  };

  const navigateAfterSeal = async (path: string) => {
    if (failures.length > 0) {
      const ok = await dialogs.confirm({
        title: 'Leave before media is saved?',
        body: `${failures.length} sealed item${failures.length === 1 ? ' has' : 's have'} not been stored on this device yet. Your written record is safe, but Chronicle can only retry these item${failures.length === 1 ? '' : 's'} while this capture remains open.`,
        confirmLabel: 'Leave anyway',
        cancelLabel: 'Stay and retry',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onNavigate(path);
  };

  const seal = async () => {
    if (!canSeal || submittingRef.current) return;
    submittingRef.current = true; setSealing(true); setError(null);
    const sealedAt = new Date().toISOString(); const originalMedia = mediaItems();
    let created: { recordId: string; sealedAt: string };
    try {
      created = await adapter.createRecord({
        submissionId: submissionId.current, text, capturedAt: capturedAt.current, sealedAt,
        hasVoice: !!voice, media: originalMedia, recordType,
        ...(capabilities.inputHelper ? { inputHelper: helperSealState({ shown: helperShown, interacted: helperInteracted, acceptedSuggestionCount }) } : {}),
      });
    } catch (e) {
      setError(`${(e as Error)?.message ?? 'The record could not be saved.'} Nothing was sealed — your wording is still here, so you can try again.`);
      setSealing(false); submittingRef.current = false; return;
    }
    let mediaFailures: MediaFailure[] = [];
    try { mediaFailures = await adapter.saveMedia(created.recordId, originalMedia); }
    catch (e) { mediaFailures = originalMedia.map(item => ({ item, reason: 'write', message: (e as Error)?.message ?? 'Could not be saved.' })); }
    try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
    setFailures(mediaFailures); if (mediaFailures.length) setError(describeFailures(mediaFailures));
    setSealedOffline(!online); setSealed({ id: created.recordId, sealedAt: created.sealedAt, text }); setSealing(false);
  };

  const retryMedia = async () => {
    if (!sealed || retrying || !failures.length) return;
    setRetrying(true);
    try { const next = await adapter.saveMedia(sealed.id, failures.map(f => f.item)); setFailures(next); setError(next.length ? describeFailures(next) : null); }
    catch (e) { setError((e as Error)?.message ?? 'Those items still could not be saved.'); }
    setRetrying(false);
  };

  if (sealed) return (
    <div>
      <h1 className="proto-h1" tabIndex={-1} ref={sealedHeadingRef}>Record sealed.</h1>
      <div className="proto-sealed-note"><div style={{ fontSize: 12, color: 'var(--p-muted)', marginBottom: 4 }}>Sealed {new Date(sealed.sealedAt).toLocaleString()}</div>{sealed.text ? <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>{sealed.text}</div> : <div className="proto-help" style={{ margin: 0 }}>Voice record only — no written wording.</div>}</div>
      <p className="proto-help" role="status" style={{ marginTop: 8 }}>{sealedOffline ? 'You were offline, so this record is saved on this device. It will be backed up automatically the next time you are online.' : 'This record is saved on this device and backed up to your private Chronicle storage.'}</p>
      {error && <p className="proto-media-error" role="alert">{error}</p>}
      {failures.length > 0 && <div className="proto-actions-row" style={{ marginBottom: 12 }}><button type="button" className="proto-btn" onClick={retryMedia} disabled={retrying}>{retrying ? 'Retrying…' : `Retry ${failures.length} item${failures.length === 1 ? '' : 's'}`}</button></div>}
      <p className="proto-help" style={{ marginBottom: 12 }}>Sealing preserves your original wording and timestamp. Media declared at seal stays bound to this record, but any item that failed to store must be retried before leaving this screen if you want Chronicle to retain its bytes.</p>
      <div className="proto-actions-row"><button type="button" className="proto-btn" data-variant="primary" onClick={() => navigateAfterSeal(adapter.detailsPath(sealed.id))}>Add details</button><button type="button" className="proto-btn" onClick={() => navigateAfterSeal(adapter.recordPath(sealed.id))}>Open record</button><button type="button" className="proto-btn" data-variant="ghost" onClick={() => navigateAfterSeal(adapter.notebookPath)}>Finish</button></div>
    </div>
  );

  return (
    <div className="proto-capture">
      <ChroniclePageHeader title="Capture" eyebrow="New bound entry" subtitle="Write freely, speak, or both. Chronicle will note the time you sealed it." />
      {notice && <p className="proto-media-error" role="status">{notice}</p>}
      {!online && <p className="proto-help" role="status" style={{ marginBottom: 10 }}>You are offline. You can still seal this record — it is saved on this device first, and backed up when you are next online. Attachments may not upload until then.</p>}
      {capabilities.recordTypes && <div className="proto-viewswitch" style={{ width: '100%', marginBottom: 12 }} role="group" aria-label="Record type"><button type="button" style={{ flex: 1 }} aria-pressed={recordType === 'incident'} data-active={recordType === 'incident'} onClick={() => setRecordType('incident')}>Incident</button><button type="button" style={{ flex: 1 }} aria-pressed={recordType === 'daily'} data-active={recordType === 'daily'} onClick={() => setRecordType('daily')}>Daily record</button></div>}
      <label className="proto-flabel" htmlFor="proto-written">Written record</label>
      <textarea id="proto-written" ref={textareaRef} className="proto-textarea" placeholder="What happened?" value={text} onChange={(e) => setText(e.target.value)} />
      {capabilities.inputHelper && <InputHelperPanel text={text} onShown={() => setHelperShown(true)} onInteract={() => setHelperInteracted(true)} onAccept={(structured) => { setHelperInteracted(true); setAcceptedSuggestionCount(count => count + 1); setText(structured); }} />}
      {capabilities.voice ? <VoiceCapture value={voice} onChange={setVoice} onActiveChange={setRecordingActive} privacyNote={capabilities.voicePrivacyNote} /> : <div className="proto-media-box"><div className="proto-media-head">Voice record</div><p className="proto-help" style={{ margin: 0 }}>{capabilities.voiceUnavailableNote ?? 'Voice recording is not available here yet.'}</p></div>}
      {capabilities.attachments && <AttachmentPicker files={files} onChange={setFiles} />}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button type="button" className="proto-btn" data-variant="primary" onClick={seal} disabled={!canSeal || sealing} style={{ flex: 1 }}>{sealing ? 'Sealing…' : 'Seal record'}</button><button type="button" className="proto-btn" data-variant="ghost" onClick={leave}>Cancel</button></div>
      {!canSeal && <p className="proto-help" style={{ marginTop: 8 }}>{recordingActive ? 'Stop the recording before sealing.' : 'Add written wording or a voice record before sealing. Attachments alone are not a record.'}</p>}
      {error && <p className="proto-media-error" role="alert">{error}</p>}
      <p className="proto-help" style={{ marginTop: 10, fontSize: 12 }}>{capabilities.storageCopy}</p>
    </div>
  );
};

export default CaptureView;
