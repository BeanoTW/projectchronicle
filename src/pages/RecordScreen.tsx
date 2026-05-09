import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, Keyboard, ChevronRight, ChevronDown, Loader2, Check, Heart, Trash2, Paperclip, RotateCcw } from 'lucide-react';
import { detectCoherence } from '@/lib/coherence';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useDevMode } from '@/contexts/DevModeContext';
import { useIncidents } from '@/hooks/useIncidents';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/chronicle/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceRecorder from '@/components/chronicle/VoiceRecorder';
import { useUploadEvidence, useEvidence } from '@/hooks/useEvidence';
import AttachmentRow from '@/components/chronicle/AttachmentRow';
import AttachmentsLibrary from '@/components/chronicle/AttachmentsLibrary';
import SystemStatusStrip from '@/components/chronicle/SystemStatusStrip';
import InteractionsEditor from '@/components/chronicle/InteractionsEditor';
import { analytics } from '@/lib/analytics/analytics';
import type { Interaction, RecordType } from '@/types/dailyRecord';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const RecordScreen = () => {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { user } = useAuth();
  const { devMode, toggleDevMode } = useDevMode();
  const { data: existingIncidents = [] } = useIncidents();
  const { toast } = useToast();
  const uploadEvidence = useUploadEvidence();
  const { data: allEvidence = [] } = useEvidence();
  const [transcribing, setTranscribing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  // Provenance for transcript-derived narrative content (carried into Review/save).
  const [transcriptProvenance, setTranscriptProvenance] = useState<{
    attachmentId: string;
    createdAt: string;
    provider: string;
    model: string;
  } | null>(null);

  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  // Daily Record extension — second record type within the same system.
  const [recordType, setRecordType] = useState<RecordType>('incident');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [location, setLocation] = useState('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [exactWords, setExactWords] = useState('');
  const [impactNote, setImpactNote] = useState('');
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  // Bumped on "Start fresh" so child inputs (Textarea, Input, InteractionsEditor)
  // remount and lose any internal/uncontrolled state.
  const [formKey, setFormKey] = useState<number>(() => Date.now());
  // Confirm dialog before clearing a draft in progress.
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Dev mode: reset dialog
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  // Dev mode: sanitised real-case demo dataset
  const [showDemoSeedDialog, setShowDemoSeedDialog] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  // Long press for dev mode
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLongPressStart = () => {
    longPressRef.current = setTimeout(() => {
      toggleDevMode();
    }, 2500);
  };
  const handleLongPressEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  // Auto-save draft to localStorage — ONLY user-entered fields
  const saveDraft = useCallback(() => {
    if (narrative.trim()) {
      localStorage.setItem('chronicle-draft', JSON.stringify({
        narrative, incidentDate, incidentTime, location,
        peopleInvolved, witnesses, exactWords, impactNote, title,
      }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    }
  }, [narrative, incidentDate, incidentTime, location, peopleInvolved, witnesses, exactWords, impactNote, title]);

  // Seed sensible defaults for a fresh record: today's date + current time.
  // Always applied first; real drafts or returnDraft override below.
  const seedDefaults = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    setIncidentDate(`${yyyy}-${mm}-${dd}`);
    setIncidentTime(`${hh}:${mi}`);
  };

  // Full draft reset — used by "Start fresh".
  // Clears every piece of state, persisted draft, derived UI, and remounts
  // child inputs by bumping formKey. Defaults are then re-seeded fresh.
  const resetForm = useCallback(() => {
    // 1) wipe persisted draft
    try { localStorage.removeItem('chronicle-draft'); } catch { /* ignore */ }
    // 2) reset all controlled fields
    setNarrative('');
    setTitle('');
    setLocation('');
    setPeopleInvolved('');
    setWitnesses('');
    setExactWords('');
    setImpactNote('');
    setInteractions([]);
    setRecordType('incident');
    setMode('text');
    // 3) reset derived UI / validation / transient flags
    setErrors({});
    setShowManualForm(false);
    setMoreDetailsOpen(false);
    setDraftSaved(false);
    setAnalysing(false);
    // 4) re-seed today's date/time
    seedDefaults();
    // 5) bump formKey so any child component with internal state remounts
    setFormKey(Date.now());
    // 6) close any open dialogs
    setShowClearDialog(false);
  }, []);

  // Restore state when returning from review screen
  useEffect(() => {
    const returnDraft = routeLocation.state?.returnDraft;
    if (returnDraft) {
      setNarrative(returnDraft.narrative || '');
      setTitle(returnDraft.title || '');
      // Preserve user-entered date/time; fall back to today/now if absent.
      if (returnDraft.incidentDate) setIncidentDate(returnDraft.incidentDate);
      if (returnDraft.incidentTime) setIncidentTime(returnDraft.incidentTime);
      if (!returnDraft.incidentDate || !returnDraft.incidentTime) {
        const now = new Date();
        if (!returnDraft.incidentDate) {
          setIncidentDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
        }
        if (!returnDraft.incidentTime) {
          setIncidentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        }
      }
      setLocation(returnDraft.location || '');
      setPeopleInvolved(Array.isArray(returnDraft.peopleInvolved) ? returnDraft.peopleInvolved.join(', ') : returnDraft.peopleInvolved || '');
      setWitnesses(Array.isArray(returnDraft.witnesses) ? returnDraft.witnesses.join(', ') : returnDraft.witnesses || '');
      setExactWords(returnDraft.exactWords || '');
      setImpactNote(returnDraft.impactNote || '');
      window.history.replaceState({}, '');
      return;
    }

    // Load draft on mount, but only if it represents a real in-progress record
    // (i.e. has narrative content). Empty/stale drafts must NOT override defaults.
    const stored = localStorage.getItem('chronicle-draft');
    let restoredFromDraft = false;
    if (stored) {
      try {
        const draft = JSON.parse(stored);
        if (draft.narrative && draft.narrative.trim()) {
          restoredFromDraft = true;
          setNarrative(draft.narrative);
          if (draft.incidentDate) setIncidentDate(draft.incidentDate);
          if (draft.incidentTime) setIncidentTime(draft.incidentTime);
          if (draft.location) setLocation(draft.location);
          if (draft.peopleInvolved) setPeopleInvolved(draft.peopleInvolved);
          if (draft.witnesses) setWitnesses(draft.witnesses);
          if (draft.exactWords) setExactWords(draft.exactWords);
          if (draft.impactNote) setImpactNote(draft.impactNote);
          if (draft.title) setTitle(draft.title);
        } else {
          // Stale empty draft — clear it so it can't keep blanking defaults later.
          localStorage.removeItem('chronicle-draft');
        }
      } catch {
        localStorage.removeItem('chronicle-draft');
      }
    }

    // Always seed today/now for fields the draft (or fresh state) didn't fill.
    if (!restoredFromDraft) {
      seedDefaults();
    }
  }, []);

  // Auto-save every 5s when narrative has content
  useEffect(() => {
    if (!narrative.trim()) return;
    const timer = setTimeout(saveDraft, 5000);
    return () => clearTimeout(timer);
  }, [narrative, saveDraft]);

  const existingPatterns = useMemo(() => {
    const result: string[] = [];
    const peopleCounts: Record<string, number> = {};
    existingIncidents.forEach(i => i.people_involved.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; }));
    Object.entries(peopleCounts).filter(([, c]) => c >= 2).forEach(([name, count]) => {
      result.push(`${name} appears in ${count} recorded incidents.`);
    });
    const catCounts: Record<string, number> = {};
    existingIncidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    Object.entries(catCounts).filter(([, c]) => c >= 3).forEach(([cat, count]) => {
      result.push(`${count} incidents relate to ${cat}.`);
    });
    return result;
  }, [existingIncidents]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!narrative.trim()) newErrors.raw_narrative = 'Please enter your account of the incident.';
    if (!incidentDate) newErrors.incident_date = 'Please select the incident date.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAnalyseAndReview = async () => {
    if (!narrative.trim()) {
      setErrors({ raw_narrative: 'Please enter your account first.' });
      return;
    }
    if (!incidentDate) {
      setErrors({ incident_date: 'Please add a date before saving.' });
      setShowManualForm(true);
      setMoreDetailsOpen(true);
      return;
    }

    // Daily Record path: bypass AI structuring; daily records are not categorised
    // and have no interpretation applied. Optional interactions[] are passed through.
    if (recordType === 'daily_record') {
      navigate('/review', {
        state: {
          draft: {
            narrative,
            title,
            incidentDate,
            incidentTime,
            location,
            category: '',
            subtype: 'Not sure yet',
            categorySource: null,
            contextDomain: '',
            peopleInvolved: peopleInvolved
              ? peopleInvolved.split(',').map(s => s.trim()).filter(Boolean)
              : [],
            witnesses: witnesses ? witnesses.split(',').map(s => s.trim()).filter(Boolean) : [],
            exactWords,
            impactNote,
            aiSummary: '',
            recordMethod: mode,
            recordType: 'daily_record',
            interactions,
            transcriptProvenance,
          },
        },
      });
      return;
    }

    setAnalysing(true);
    // AI structuring is best-effort and ONLY for incident records.
    // If it fails (network/auth/quota/rate-limit), we silently navigate to Review
    // with empty AI fields so save is never blocked and no false-failure UI shows.
    // Real save failures are surfaced separately by the Review/save path.
    let data: any = null;
    try {
      // Defensive: ensure the session is hydrated and pass the access token
      // explicitly. Avoids race-condition 401s in the live preview where
      // invoke() is called before the SDK has attached the Authorization header.
      const { data: sessionRes } = await supabase.auth.getSession();
      const accessToken = sessionRes?.session?.access_token;
      if (!accessToken) throw new Error('not-authenticated');

      analytics.track('ai_assist_used', { feature: 'analyse_incident' });
      const res = await supabase.functions.invoke('analyse-incident', {
        body: { narrative, existingPatterns: existingPatterns.length > 0 ? existingPatterns : undefined },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      data = res.data;
    } catch (e) {
      // Calm fallback — never destructive. The user can still review and save.
      console.warn('analyse-incident unavailable, continuing without AI structuring:', e);
      toast({
        title: 'AI assist is unavailable',
        description: 'You can continue and save your record manually.',
      });
    } finally {
      setAnalysing(false);
    }

    navigate('/review', {
      state: {
        draft: {
          narrative,
          title: title || data?.title || '',
          incidentDate: incidentDate || data?.incident_date || '',
          incidentTime: incidentTime || data?.incident_time || '',
          location: location || data?.location || '',
          category: data?.category || '',
          subtype: data?.subtype || 'Not sure yet',
          categorySource: data?.category ? 'ai' as const : null,
          contextDomain: '',
          peopleInvolved: peopleInvolved
            ? peopleInvolved.split(',').map(s => s.trim()).filter(Boolean)
            : data?.people_involved || [],
          witnesses: witnesses ? witnesses.split(',').map(s => s.trim()).filter(Boolean) : [],
          exactWords: exactWords || data?.exact_words || '',
          impactNote,
          aiSummary: data?.summary || '',
          recordMethod: mode,
          recordType: 'incident',
          interactions: [],
          transcriptProvenance,
        },
      },
    });
  };

  const handleSaveDirectly = () => {
    if (!validate()) return;
    navigate('/review', {
      state: {
        draft: {
          narrative,
          title,
          incidentDate,
          incidentTime,
          location,
          category: '',
          subtype: 'Not sure yet',
          categorySource: null,
          contextDomain: '',
          peopleInvolved: peopleInvolved ? peopleInvolved.split(',').map(s => s.trim()).filter(Boolean) : [],
          witnesses: witnesses ? witnesses.split(',').map(s => s.trim()).filter(Boolean) : [],
          exactWords,
          impactNote,
          aiSummary: '',
          recordMethod: mode,
          recordType,
          interactions: recordType === 'daily_record' ? interactions : [],
          transcriptProvenance,
        },
      },
    });
  };

  const handleResetAll = async () => {
    if (resetConfirmText !== 'RESET') return;
    setResetting(true);
    try {
      const { data: evidenceFiles } = await supabase.from('evidence_files').select('file_path');
      if (evidenceFiles?.length) {
        await supabase.storage.from('evidence').remove(evidenceFiles.map(f => f.file_path));
      }
      await supabase.from('evidence_files').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('follow_up_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('edit_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('incidents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      localStorage.removeItem('chronicle-draft');
      setShowResetDialog(false);
      setResetConfirmText('');
      toast({ title: 'All data reset', description: 'Everything has been cleared.' });
      navigate('/timeline');
    } catch (e) {
      toast({ title: 'Reset failed', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  const hasText = narrative.trim().length > 0;
  const isCoherent = useMemo(() => detectCoherence(narrative), [narrative]);

  const detailFields = (
    <div className="space-y-5 bg-card rounded-xl p-4 border border-border shadow-[var(--shadow-card)] mt-2">
      <div>
        <Label htmlFor="title" className="text-[13px] font-medium">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title for this incident" className="mt-1.5 rounded-lg" />
      </div>
      <div>
        <Label htmlFor="location" className="text-[13px] font-medium">Location</Label>
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where did it happen?" className="mt-1.5 rounded-lg" />
      </div>
      <div>
        <Label htmlFor="people" className="text-[13px] font-medium">People involved</Label>
        <Input id="people" value={peopleInvolved} onChange={(e) => setPeopleInvolved(e.target.value)} placeholder="Comma-separated names" className="mt-1.5 rounded-lg" />
      </div>
      <div>
        <Label htmlFor="witnesses" className="text-[13px] font-medium">Witnesses</Label>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">Were any staff or customers present?</p>
        <Input id="witnesses" value={witnesses} onChange={(e) => setWitnesses(e.target.value)} placeholder="Comma-separated names" className="rounded-lg" />
      </div>
      <div>
        <Label htmlFor="exactWords" className="text-[13px] font-medium">
          Exact wording <span className="text-primary font-normal">(important)</span>
        </Label>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Include key phrases if you remember them.</p>
        <Textarea id="exactWords" value={exactWords} onChange={(e) => setExactWords(e.target.value)} placeholder="What was said, written, or messaged?" className="min-h-[80px] rounded-lg text-[14px]" />
      </div>
      <div>
        <Label htmlFor="impact" className="text-[13px] font-medium">
          Impact <span className="font-normal text-muted-foreground">(what changed?)</span>
        </Label>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">e.g. felt anxious, avoided area, affected work</p>
        <Textarea id="impact" value={impactNote} onChange={(e) => setImpactNote(e.target.value)} placeholder="How did this affect you?" className="min-h-[80px] rounded-lg text-[14px]" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 page-enter relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-foreground" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Dev mode indicator */}
      <AnimatePresence>
        {devMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-1 left-1/2 -translate-x-1/2 z-50 px-2.5 py-0.5 bg-destructive/90 text-destructive-foreground text-[9px] font-bold tracking-widest rounded-full uppercase"
          >
            Dev Mode
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        title="Record"
        subtitle="Record it in your own words"
      >
        <button
          onClick={() => setShowLibrary(true)}
          className="p-2 rounded-lg text-warm-accent/65 hover:text-warm-accent/90 active:text-warm-accent/50 hover:bg-warm-accent/5 active:bg-warm-accent/10 transition-colors duration-150 relative"
          aria-label="Attachments"
        >
          <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.5} />
          {allEvidence.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
              {allEvidence.length}
            </span>
          )}
        </button>
      </PageHeader>

      {/* Record-type toggle (Daily Record extension) — outlined glass segments */}
      <div className="px-5 -mt-1 mb-2.5">
        <div className="flex gap-2">
          <button
            onClick={() => setRecordType('incident')}
            className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold backdrop-blur-md transition-all duration-200 ease-out active:scale-[0.98] border ${
              recordType === 'incident'
                ? 'bg-primary/[0.06] dark:bg-primary/[0.08] border-primary/55 text-primary shadow-[inset_0_0_0_0.5px_hsl(var(--primary)/0.25)]'
                : 'bg-card/40 dark:bg-white/[0.02] border-border/50 dark:border-white/10 text-muted-foreground hover:text-foreground'
            }`}
          >
            Incident
          </button>
          <button
            onClick={() => setRecordType('daily_record')}
            className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold backdrop-blur-md transition-all duration-200 ease-out active:scale-[0.98] border ${
              recordType === 'daily_record'
                ? 'bg-warm-accent/[0.06] dark:bg-warm-accent/[0.08] border-warm-accent/55 text-warm-accent shadow-[inset_0_0_0_0.5px_hsl(var(--warm-accent)/0.25)]'
                : 'bg-card/40 dark:bg-white/[0.02] border-border/50 dark:border-white/10 text-muted-foreground hover:text-foreground'
            }`}
          >
            Daily record
          </button>
        </div>
      </div>

      {/* Mode Toggle (Voice / Text) — single outlined glass pill with subtle divider */}
      <div className="px-5 mb-2">
        <div className="relative flex items-stretch rounded-xl border border-border/50 dark:border-white/10 bg-card/40 dark:bg-white/[0.02] backdrop-blur-md overflow-hidden">
          <button
            onClick={() => setMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors duration-200 ease-out active:scale-[0.98] ${
              mode === 'voice' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic className="h-4 w-4" strokeWidth={mode === 'voice' ? 2.25 : 1.75} /> Voice
          </button>
          <div aria-hidden className="w-px my-2 bg-border/60 dark:bg-white/10" />
          <button
            onClick={() => setMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors duration-200 ease-out active:scale-[0.98] ${
              mode === 'text' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard className="h-4 w-4" strokeWidth={mode === 'text' ? 2.25 : 1.75} /> Text
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ========== VOICE MODE ========== */}
        {mode === 'voice' && (
          <motion.div
            key={`voice-mode-${formKey}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <VoiceRecorder
              recordType={recordType}
              onAudioCaptured={async (blob, duration) => {
                if (!user) return;
                try {
                  const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
                  const uploaded = await uploadEvidence.mutateAsync({ file, description: `Voice note (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')})` });
                  toast({ title: 'Voice note saved', description: 'Stored as an attachment. Transcribing…' });

                  setTranscribing(true);
                  try {
                    const formData = new FormData();
                    formData.append('audio', blob);
                    analytics.track('ai_assist_used', { feature: 'transcribe_audio' });
                    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
                      body: formData,
                    });
                    if (error) throw error;
                    if (data?.transcript && data.transcript !== '[inaudible]') {
                      setNarrative(prev => prev ? prev + '\n\n' + data.transcript : data.transcript);
                      // Capture provenance so the saved record links the transcript
                      // back to the exact attachment used.
                      if (uploaded?.id) {
                        setTranscriptProvenance({
                          attachmentId: uploaded.id,
                          createdAt: new Date().toISOString(),
                          provider: 'lovable-ai',
                          model: 'google/gemini-2.5-flash',
                        });
                      }
                      setMode('text');
                      toast({ title: 'Transcript added', description: 'Your words have been added as editable text.' });
                    } else {
                      toast({
                        title: 'Transcription could not be completed',
                        description: 'Your audio has been saved, and you can continue by typing your record manually.',
                      });
                    }
                  } catch (err) {
                    console.warn('[transcribe-audio] failed:', err);
                    toast({
                      title: 'Transcription could not be completed',
                      description: 'Your audio has been saved, and you can continue by typing your record manually.',
                    });
                  } finally {
                    setTranscribing(false);
                  }
                } catch {
                  toast({ title: 'Upload failed', description: 'Could not save recording. Please try again.', variant: 'destructive' });
                }
              }}
              onSwitchToText={() => setMode('text')}
            />
            {transcribing && (
              <div className="px-5 mb-4">
                <div className="flex items-center gap-2 px-4 py-3 bg-primary/[0.04] border border-primary/10 rounded-xl">
                  <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                  <p className="text-[12px] text-primary font-medium">Transcribing your recording…</p>
                </div>
              </div>
            )}

            {!hasText && (
              <div className="px-5 mt-2 mb-4">
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed text-center">
                  Your input is preserved and organised into a structured record
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ========== TEXT MODE ========== */}
        {mode === 'text' && (
          <motion.div
            key={`text-mode-${formKey}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
          >
            {/* Prompt Cues — only before typing */}
            {!hasText && (
              <div className="px-5 mb-4 space-y-3">
                <div className="overflow-x-auto scrollbar-hide">
                  <div className="flex gap-1.5 min-w-max text-[11px] text-muted-foreground/70">
                    {recordType === 'daily_record' ? (
                      <>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">Interactions</span>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">Work</span>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">Context</span>
                      </>
                    ) : (
                      <>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">When</span>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">Where</span>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">Who</span>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">What happened</span>
                        <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">What was said</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed text-center">
                  {recordType === 'daily_record'
                    ? 'Your original content is preserved. Changes are recorded as updates.'
                    : 'Your original content is preserved and organised into a structured record. Changes are recorded as updates.'}
                </p>
              </div>
            )}

            <div className="px-5 space-y-5">
              {/* Narrative Input */}
              <div className="writing-focus rounded-xl border border-border bg-card transition-all duration-200">
                <Textarea
                  id="narrative"
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder={
                    recordType === 'daily_record'
                      ? 'Record what your day involved — interactions, work, or context'
                      : 'Write what happened — include anything said, done, or noticed.'
                  }
                  className="min-h-[200px] bg-transparent border-0 rounded-lg focus:ring-0 focus-visible:ring-0 text-[15px] leading-[1.7] shadow-none resize-none px-4 pt-4"
                />
                <div className="flex items-center justify-between px-4 pb-2 gap-2">
                  {narrative.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/40">{narrative.length} characters</p>
                  )}
                  <div className="flex items-center gap-3 ml-auto">
                    <AnimatePresence>
                      {draftSaved && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-[11px] text-primary/60 font-medium"
                        >
                          Draft saved
                        </motion.p>
                      )}
                    </AnimatePresence>
                    {hasText && (
                      <button
                        type="button"
                        onClick={() => setShowClearDialog(true)}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 font-medium hover:text-destructive transition-colors"
                        aria-label="Start fresh — clear this draft"
                      >
                        <RotateCcw className="h-3 w-3" /> Start fresh
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {errors.raw_narrative && (
                <p className="text-[12px] text-destructive -mt-3">{errors.raw_narrative}</p>
              )}

              {/* Optional structured interactions — daily records only */}
              {recordType === 'daily_record' && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
                  <div>
                    <Label className="text-[13px] font-medium text-foreground">
                      Notable interactions <span className="text-muted-foreground/60 font-normal">(optional)</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Add structured entries if useful. Always optional.
                    </p>
                  </div>
                  <InteractionsEditor
                    interactions={interactions}
                    onChange={setInteractions}
                  />
                </div>
              )}

              {/* Reassurance text */}
              {hasText && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-muted-foreground/60 text-center -mt-2"
                >
                  Approximate is fine · You can edit this later
                </motion.p>
              )}

              {/* Date & Time — always visible when there's text */}
              {hasText && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="date" className="text-[13px] font-medium">When did this happen? *</Label>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1">Approximate is fine</p>
                      <Input id="date" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="rounded-lg" />
                      {errors.incident_date && <p className="text-[12px] text-destructive mt-1">{errors.incident_date}</p>}
                    </div>
                    <div>
                      <Label htmlFor="time" className="text-[13px] font-medium">Time</Label>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1">Optional</p>
                      <Input id="time" type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} className="rounded-lg" />
                    </div>
                  </div>

                  {/* Optional details collapsible */}
                  <Collapsible open={showManualForm || moreDetailsOpen} onOpenChange={(open) => { setMoreDetailsOpen(open); if (open) setShowManualForm(true); }}>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-[13px] text-muted-foreground font-medium py-1 transition-all">
                      {showManualForm || moreDetailsOpen ? (
                        <><ChevronDown className="h-4 w-4 transition-transform duration-200" /> Hide details</>
                      ) : (
                        <><ChevronRight className="h-4 w-4 transition-transform duration-200" /> Add more details</>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                      {detailFields}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Primary action: Save */}
                  <div className="space-y-2 pt-2 pb-8">
                    {recordType === 'daily_record' ? (
                      <Button
                        className="w-full rounded-xl h-12 text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition-all"
                        onClick={handleAnalyseAndReview}
                        disabled={!incidentDate}
                      >
                        Save daily record
                      </Button>
                    ) : isCoherent ? (
                      <>
                        <Button
                          className="w-full rounded-xl h-12 text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition-all"
                          onClick={handleAnalyseAndReview}
                          disabled={analysing || !incidentDate}
                        >
                          {analysing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Structuring your record…</>
                          ) : (
                            'Save record'
                          )}
                        </Button>
                        <button
                          onClick={handleSaveDirectly}
                          disabled={!incidentDate}
                          className="w-full text-center py-2 text-[13px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors disabled:opacity-40"
                        >
                          Save without structuring
                        </button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="w-full rounded-xl h-12 text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition-all"
                          onClick={handleAnalyseAndReview}
                          disabled={analysing || !incidentDate}
                        >
                          {analysing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Structuring your record…</>
                          ) : (
                            'Structure & save'
                          )}
                        </Button>
                        <button
                          onClick={handleSaveDirectly}
                          disabled={!incidentDate}
                          className="w-full text-center py-2 text-[13px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors disabled:opacity-40"
                        >
                          Save as is
                        </button>
                      </>
                    )}
                    {!incidentDate && hasText && (
                      <p className="text-[11px] text-muted-foreground/60 text-center">Add a date to save this record</p>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reassurance footer with long-press dev mode trigger */}
      <div className="mt-3 mb-28 mx-5 py-3 px-4 rounded-xl bg-muted/30 backdrop-blur-sm text-center space-y-0.5">
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          {hasText
            ? 'You can edit this later'
            : 'Take your time — you can start with anything'}
        </p>
        <div
          className="flex items-center justify-center gap-1 select-none cursor-default"
          onPointerDown={handleLongPressStart}
          onPointerUp={handleLongPressEnd}
          onPointerLeave={handleLongPressEnd}
        >
          <Heart className="h-2.5 w-2.5 text-primary/30" strokeWidth={1.5} />
          <p className="text-[10px] text-muted-foreground/40">Built with care</p>
        </div>
      </div>

      {/* Dev mode controls */}
      {devMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mb-28 p-4 rounded-xl border-2 border-destructive/20 bg-destructive/[0.03] space-y-3"
        >
          <p className="text-[12px] font-bold text-destructive uppercase tracking-wide">Developer Controls</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-destructive/20 text-[13px]"
            onClick={() => setShowResetDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Reset all data
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={seeding || !user}
            className="w-full text-[13px] border-primary/30 text-primary"
            onClick={async () => {
              if (!user) return;
              setSeeding(true);
              try {
                const { wipeAndSeedTestData } = await import('@/local/devSeed');
                const res = await wipeAndSeedTestData(user.id);
                toast({
                  title: 'Test dataset seeded',
                  description: `${res.totalCreated} records (${res.incidents} incidents, ${res.dailyRecords} daily). Categories: ${Object.entries(res.perCategory).map(([k, v]) => `${k}:${v}`).join(', ')}`,
                });
                navigate('/timeline');
              } catch (e) {
                toast({ title: 'Seed failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' });
              } finally {
                setSeeding(false);
              }
            }}
          >
            {seeding ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            Wipe + seed test dataset (60)
          </Button>
          <p className="text-[10px] text-muted-foreground/70 leading-snug">
            Replaces every local + cloud record for this account with a controlled
            50–70 entry dataset spanning Oct 2025 → today, distributed across all
            categories for visual testing.
          </p>

          <Button
            variant="outline"
            size="sm"
            disabled={seedingDemo || !user}
            className="w-full text-[13px] border-primary/30 text-primary"
            onClick={() => setShowDemoSeedDialog(true)}
          >
            {seedingDemo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            Wipe + seed sanitised real-case demo dataset
          </Button>
          <p className="text-[10px] text-muted-foreground/70 leading-snug">
            Replaces every local + cloud record for this account with a fixed
            17-record demonstration dataset based on a sanitised real workplace
            dispute. For demo and testing only.
          </p>
        </motion.div>
      )}


      {/* Reset confirmation dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="rounded-2xl mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] text-destructive">Reset all data</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              This will permanently delete all incidents, follow-up notes, and evidence files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground">Type RESET to confirm</label>
            <Input
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="text-[13px] font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px]" onClick={() => setResetConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAll}
              disabled={resetConfirmText !== 'RESET' || resetting}
              className="text-[13px] bg-destructive hover:bg-destructive/90"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear-draft confirm dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-2xl mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px]">Start fresh?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              This clears the current draft (your account, details and any interactions you've added) and resets the date and time. Saved records are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px]">Keep draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={resetForm}
              className="text-[13px]"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Clear and start fresh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sanitised real-case demo dataset confirm dialog */}
      <AlertDialog open={showDemoSeedDialog} onOpenChange={setShowDemoSeedDialog}>
        <AlertDialogContent className="rounded-2xl mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px]">Seed sanitised real-case demo dataset?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              This will replace every local and cloud record for this account with a sanitised demonstration dataset based on a real workplace dispute. This is for demo and testing only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={seedingDemo || !user}
              onClick={async () => {
                if (!user) return;
                setSeedingDemo(true);
                try {
                  const { wipeAndSeedRealCaseDataset } = await import('@/local/devSeedRealCase');
                  const res = await wipeAndSeedRealCaseDataset(user.id);
                  toast({
                    title: 'Demo dataset seeded',
                    description: `${res.totalCreated} records (${res.incidents} incidents, ${res.dailyRecords} daily).`,
                  });
                  setShowDemoSeedDialog(false);
                  navigate('/timeline');
                } catch (e) {
                  toast({
                    title: 'Seed failed',
                    description: e instanceof Error ? e.message : 'Try again',
                    variant: 'destructive',
                  });
                } finally {
                  setSeedingDemo(false);
                }
              }}
              className="text-[13px]"
            >
              {seedingDemo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
              Wipe + seed demo dataset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SystemStatusStrip />
    </div>
  );
};
export default RecordScreen;
