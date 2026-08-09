// Chronicle V2 (candidate) voice capture. Browser MediaRecorder, no upload, no transcription.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialogs } from '../components/Dialog';
import { LIMITS, formatBytes, formatDuration } from './mediaCore';
import { useBlobUrl } from './useBlobUrl';

export interface VoiceDraft {
  blob: Blob;
  mime: string;
  duration_ms: number;
}

interface Props {
  value: VoiceDraft | null;
  onChange: (v: VoiceDraft | null) => void;
  /** Lets the parent block navigation / sealing while a recording is live. */
  onActiveChange?: (active: boolean) => void;
  disabled?: boolean;
}

type Status = 'idle' | 'requesting' | 'recording' | 'paused' | 'denied' | 'error' | 'unsupported';

const pickMime = (): string => {
  const R = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!R?.isTypeSupported) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find(c => R.isTypeSupported(c)) ?? '';
};

const VoiceCapture = ({ value, onChange, onActiveChange, disabled }: Props) => {
  const dialogs = useDialogs();
  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedRef = useRef(0);
  const accumRef = useRef(0);
  const cancelledRef = useRef(false);
  const tickRef = useRef<number | null>(null);

  const playbackUrl = useBlobUrl(value?.blob ?? null);
  const active = status === 'recording' || status === 'paused';

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      typeof window.MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia;
    if (!supported) setStatus('unsupported');
  }, []);

  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  const stopTicker = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => { stopTicker(); releaseStream(); }, []);

  const finalise = useCallback((mime: string) => {
    const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
    chunksRef.current = [];
    if (cancelledRef.current || blob.size === 0) {
      cancelledRef.current = false;
      setElapsed(0);
      accumRef.current = 0;
      setStatus('idle');
      return;
    }
    onChange({ blob, mime: blob.type, duration_ms: accumRef.current });
    setElapsed(0);
    accumRef.current = 0;
    setStatus('idle');
  }, [onChange]);

  const start = async () => {
    if (active || disabled) return;                      // never two recordings at once
    if (value) {
      const ok = await dialogs.confirm({
        title: 'Replace this recording?',
        body: 'The voice record you already made will be discarded and cannot be recovered.',
        confirmLabel: 'Record again',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setMessage(null);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      accumRef.current = 0;
      cancelledRef.current = false;
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onerror = () => {
        setMessage('The recording stopped because of a device error. Your text is unaffected.');
        setStatus('error');
        releaseStream();
      };
      rec.onstop = () => { releaseStream(); finalise(rec.mimeType || mime); };
      rec.start(1000);
      startedRef.current = Date.now();
      setStatus('recording');
      onChange(null);
      tickRef.current = window.setInterval(() => {
        const ms = accumRef.current + (Date.now() - startedRef.current);
        setElapsed(ms);
        if (ms >= LIMITS.MAX_VOICE_MS) {
          setMessage(`Recording stopped at the ${formatDuration(LIMITS.MAX_VOICE_MS)} V2 capture limit.`);
          stopTicker();
          accumRef.current = LIMITS.MAX_VOICE_MS;
          try { recorderRef.current?.stop(); } catch { /* ignore */ }
        }
      }, 200);
    } catch (err) {
      releaseStream();
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
        setMessage('Microphone access was refused. Allow the microphone in your browser’s site settings, then try again. You can still write your record.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setStatus('error');
        setMessage('No microphone was found on this device. You can still write your record.');
      } else {
        setStatus('error');
        setMessage('The microphone could not be started. You can still write your record.');
      }
    }
  };

  const pause = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause();
    accumRef.current += Date.now() - startedRef.current;
    stopTicker();
    setElapsed(accumRef.current);
    setStatus('paused');
  };

  const resume = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    startedRef.current = Date.now();
    setStatus('recording');
    tickRef.current = window.setInterval(() => {
      const ms = accumRef.current + (Date.now() - startedRef.current);
      setElapsed(ms);
      if (ms >= LIMITS.MAX_VOICE_MS) {
        setMessage(`Recording stopped at the ${formatDuration(LIMITS.MAX_VOICE_MS)} V2 capture limit.`);
        stopTicker();
        accumRef.current = LIMITS.MAX_VOICE_MS;
        try { recorderRef.current?.stop(); } catch { /* ignore */ }
      }
    }, 200);
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') accumRef.current += Date.now() - startedRef.current;
    stopTicker();
    try { rec.stop(); } catch { /* ignore */ }
  };

  const cancel = async () => {
    const ok = await dialogs.confirm({
      title: 'Discard this recording?',
      body: 'The audio captured so far cannot be recovered. Anything you have written stays as it is.',
      confirmLabel: 'Discard recording',
      tone: 'danger',
    });
    if (!ok) return;
    cancelledRef.current = true;
    const rec = recorderRef.current;
    stopTicker();
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* ignore */ } }
    else { setStatus('idle'); setElapsed(0); accumRef.current = 0; releaseStream(); }
  };

  const discardCompleted = async () => {
    const ok = await dialogs.confirm({
      title: 'Discard this voice record?',
      body: 'The recording cannot be recovered. Anything you have written stays as it is.',
      confirmLabel: 'Discard voice record',
      tone: 'danger',
    });
    if (!ok) return;
    onChange(null);
    setMessage(null);
  };

  if (status === 'unsupported') {
    return (
      <div className="proto-media-box">
        <div className="proto-media-head">Voice record</div>
        <p className="proto-help" style={{ margin: 0 }}>
          This browser does not support voice recording. You can still write your record and add
          an audio file as a supporting attachment.
        </p>
      </div>
    );
  }

  return (
    <div className="proto-media-box" data-live={active || undefined}>
      <div className="proto-media-head">
        <span>Voice record</span>
        {(active || elapsed > 0) && (
          <span className="proto-timer" aria-live="polite">
            {status === 'paused' ? 'Paused ' : ''}{formatDuration(elapsed)}
          </span>
        )}
      </div>

      {value ? (
        <div>
          <div className="proto-media-meta">
            Recording ready · {formatDuration(value.duration_ms)} · {formatBytes(value.blob.size)}
          </div>
          {playbackUrl && <audio className="proto-audio" controls src={playbackUrl} preload="metadata" />}
          <div className="proto-actions-row" style={{ marginTop: 8 }}>
            <button type="button" className="proto-btn" onClick={start} disabled={disabled}>Re-record</button>
            <button type="button" className="proto-btn" data-variant="ghost" onClick={discardCompleted}>Discard</button>
          </div>
        </div>
      ) : (
        <div className="proto-actions-row" style={{ flexWrap: 'wrap' }}>
          {status === 'recording' && (
            <>
              <button type="button" className="proto-btn" onClick={pause}>Pause</button>
              <button type="button" className="proto-btn" data-variant="primary" onClick={stop}>Stop</button>
              <button type="button" className="proto-btn" data-variant="ghost" onClick={cancel}>Cancel</button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button type="button" className="proto-btn" onClick={resume}>Resume</button>
              <button type="button" className="proto-btn" data-variant="primary" onClick={stop}>Stop</button>
              <button type="button" className="proto-btn" data-variant="ghost" onClick={cancel}>Cancel</button>
            </>
          )}
          {(status === 'idle' || status === 'denied' || status === 'error' || status === 'requesting') && (
            <button
              type="button"
              className="proto-btn"
              onClick={start}
              disabled={disabled || status === 'requesting'}
            >
              {status === 'requesting' ? 'Requesting microphone…'
                : status === 'denied' || status === 'error' ? 'Try again' : 'Record voice'}
            </button>
          )}
        </div>
      )}

      {status === 'recording' && (
        <p className="proto-help" style={{ marginTop: 8 }}>
          Recording. Audio stays on this device and is not sent anywhere.
        </p>
      )}
      {message && <p className="proto-media-error">{message}</p>}
    </div>
  );
};

export default VoiceCapture;
