import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Play, Pause, Loader2, MicOff, Keyboard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

type RecordingState = "idle" | "requesting" | "recording" | "processing" | "done" | "denied";

interface VoiceRecorderProps {
  onAudioCaptured: (blob: Blob, duration: number) => void;
  onSwitchToText: () => void;
  recordType?: 'incident' | 'daily_record';
}

const VoiceRecorder = ({ onAudioCaptured, onSwitchToText, recordType = 'incident' }: VoiceRecorderProps) => {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const isDailyRecord = recordType === 'daily_record';

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onAudioCaptured(blob, elapsed);
        stream.getTracks().forEach((t) => t.stop());
        setState("done");
      };

      recorder.start(1000); // Collect data every second
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err: unknown) {
      const error = err as DOMException;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setState("denied");
      } else {
        setState("idle");
      }
    }
  }, [elapsed, onAudioCaptured]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState("processing");
    mediaRecorderRef.current?.stop();
  }, []);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setElapsed(0);
    setState("idle");
    setIsPlaying(false);
  }, [audioUrl]);

  return (
    <div className="px-5 pt-10 mb-4 flex flex-col items-center">
      <AnimatePresence mode="wait">
        {/* IDLE — Ready to record */}
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center"
          >
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-150 ease-out active:scale-[0.96] active:duration-100"
              style={{
                background: isDailyRecord
                  ? 'linear-gradient(180deg, hsl(38 70% 56%) 0%, hsl(var(--warm-accent)) 50%, hsl(28 65% 38%) 100%)'
                  : 'linear-gradient(180deg, hsl(100 46% 62%) 0%, hsl(var(--primary)) 50%, hsl(100 42% 46%) 100%)',
                boxShadow: isDailyRecord
                  ? '0 14px 28px -6px hsl(220 25% 12% / 0.22), 0 4px 10px -2px hsl(220 25% 12% / 0.12), inset 0 2px 2.5px hsl(0 0% 100% / 0.45), inset 0 -3px 6px hsl(28 70% 22% / 0.22)'
                  : '0 14px 28px -6px hsl(220 25% 12% / 0.22), 0 4px 10px -2px hsl(220 25% 12% / 0.12), inset 0 2px 2.5px hsl(0 0% 100% / 0.45), inset 0 -3px 6px hsl(100 50% 20% / 0.22)',
              }}
            >
              <Mic className="h-8 w-8 text-white" strokeWidth={2.25} />
            </button>
            <p className="text-[14px] font-medium text-foreground mb-1">Tap to record</p>
            <p className="text-[12px] text-muted-foreground">
              Record it in your own words
            </p>
          </motion.div>
        )}

        {/* REQUESTING — Waiting for permission */}
        {state === "requesting" && (
          <motion.div
            key="requesting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 rounded-full bg-muted/30 border-2 border-border flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
            <p className="text-[14px] font-medium text-foreground mb-1">Requesting microphone access</p>
            <p className="text-[12px] text-muted-foreground">Please allow when prompted</p>
          </motion.div>
        )}

        {/* RECORDING — Active capture */}
        {state === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <div className="relative mb-4">
              {/* Pulse rings */}
              <motion.div
                className="absolute inset-0 rounded-full bg-destructive/10"
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 80, height: 80 }}
              />
              <button
                onClick={stopRecording}
                className="relative w-20 h-20 rounded-full bg-destructive/15 border-2 border-destructive/40 flex items-center justify-center active:scale-[0.95] transition-transform z-10"
              >
                <Square className="h-7 w-7 text-destructive fill-destructive" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <p className="text-[16px] font-semibold text-foreground tabular-nums">{formatTime(elapsed)}</p>
            </div>
            <p className="text-[12px] text-muted-foreground">Tap the square to stop</p>
          </motion.div>
        )}

        {/* PROCESSING — Saving */}
        {state === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-[14px] font-medium text-foreground mb-1">Saving recording…</p>
            <p className="text-[12px] text-muted-foreground">This won't take long</p>
          </motion.div>
        )}

        {/* DONE — Playback preview */}
        {state === "done" && audioUrl && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full flex flex-col items-center"
          >
            <div className="w-full bg-card border border-border rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlayback}
                  className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 active:scale-[0.95] transition-transform"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 text-primary" />
                  ) : (
                    <Play className="h-5 w-5 text-primary ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">Voice note</p>
                  <p className="text-[11px] text-muted-foreground">{formatTime(elapsed)} · Saved</p>
                </div>
              </div>
              <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed mt-2">
                Voice recordings are saved as attachments and remain available unless deleted.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-[13px]" onClick={resetRecording}>
                Record again
              </Button>
              <Button variant="outline" size="sm" className="text-[13px]" onClick={onSwitchToText}>
                <Keyboard className="h-3.5 w-3.5 mr-1.5" /> Add text notes
              </Button>
            </div>
          </motion.div>
        )}

        {/* DENIED — No permission */}
        {state === "denied" && (
          <motion.div
            key="denied"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center px-4"
          >
            <div className="w-20 h-20 rounded-full bg-destructive/5 border-2 border-destructive/15 flex items-center justify-center mb-4">
              <MicOff className="h-8 w-8 text-destructive/60" />
            </div>
            <p className="text-[14px] font-medium text-foreground mb-1">Microphone access denied</p>
            <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed max-w-[280px]">
              To use voice recording, allow microphone access in your browser settings and try again.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-[13px]" onClick={() => setState("idle")}>
                Try again
              </Button>
              <Button variant="outline" size="sm" className="text-[13px]" onClick={onSwitchToText}>
                <Keyboard className="h-3.5 w-3.5 mr-1.5" /> Use text instead
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceRecorder;
