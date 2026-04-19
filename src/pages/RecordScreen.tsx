import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, Keyboard, ChevronRight, ChevronDown, Loader2, Check, Heart, Trash2, Paperclip } from 'lucide-react';
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
import InteractionsEditor from '@/components/chronicle/InteractionsEditor';
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

  const [mode, setMode] = useState<'voice' | 'text'>('text');
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

  // Dev mode: reset dialog
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

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

  // Restore state when returning from review screen
  useEffect(() => {
    const returnDraft = routeLocation.state?.returnDraft;
    if (returnDraft) {
      setNarrative(returnDraft.narrative || '');
      setTitle(returnDraft.title || '');
      setIncidentDate(returnDraft.incidentDate || '');
      setIncidentTime(returnDraft.incidentTime || '');
      setLocation(returnDraft.location || '');
      setPeopleInvolved(Array.isArray(returnDraft.peopleInvolved) ? returnDraft.peopleInvolved.join(', ') : returnDraft.peopleInvolved || '');
      setWitnesses(Array.isArray(returnDraft.witnesses) ? returnDraft.witnesses.join(', ') : returnDraft.witnesses || '');
      setExactWords(returnDraft.exactWords || '');
      setImpactNote(returnDraft.impactNote || '');
      window.history.replaceState({}, '');
      return;
    }

    // Load draft on mount
    const stored = localStorage.getItem('chronicle-draft');
    if (stored) {
      try {
        const draft = JSON.parse(stored);
        if (draft.narrative) setNarrative(draft.narrative);
        if (draft.incidentDate) setIncidentDate(draft.incidentDate);
        if (draft.incidentTime) setIncidentTime(draft.incidentTime);
        if (draft.location) setLocation(draft.location);
        if (draft.peopleInvolved) setPeopleInvolved(draft.peopleInvolved);
        if (draft.witnesses) setWitnesses(draft.witnesses);
        if (draft.exactWords) setExactWords(draft.exactWords);
        if (draft.impactNote) setImpactNote(draft.impactNote);
        if (draft.title) setTitle(draft.title);
      } catch { /* ignore */ }
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
          },
        },
      });
      return;
    }

    setAnalysing(true);
    // AI structuring is best-effort. If it fails (network/auth/quota), we still
    // navigate to Review with empty AI fields so save is never blocked.
    let data: any = null;
    try {
      const res = await supabase.functions.invoke('analyse-incident', {
        body: { narrative, existingPatterns: existingPatterns.length > 0 ? existingPatterns : undefined },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      data = res.data;
    } catch (e) {
      console.warn('analyse-incident failed, continuing without AI structuring:', e);
      toast({
        title: 'Continuing without AI assist',
        description: 'You can review and save your record as normal.',
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
    <div className="min-h-screen pb-24 page-enter relative overflow-hidden">
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
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors relative"
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

      {/* Record-type toggle (Daily Record extension) */}
      <div className="px-5 mb-3">
        <div className="flex bg-muted/40 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setRecordType('incident')}
            className={`flex-1 py-2 rounded-md text-[12px] font-semibold transition-colors ${
              recordType === 'incident' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Incident
          </button>
          <button
            onClick={() => setRecordType('daily_record')}
            className={`flex-1 py-2 rounded-md text-[12px] font-semibold transition-colors ${
              recordType === 'daily_record' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Daily record
          </button>
        </div>
      </div>

      {/* Mode Toggle (Voice / Text) */}
      <div className="px-5 mb-5">
        <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
              mode === 'voice' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic className="h-4 w-4" /> Voice
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
              mode === 'text' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard className="h-4 w-4" /> Text
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ========== VOICE MODE ========== */}
        {mode === 'voice' && (
          <motion.div
            key="voice-mode"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <VoiceRecorder
              onAudioCaptured={async (blob, duration) => {
                if (!user) return;
                try {
                  const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
                  await uploadEvidence.mutateAsync({ file, description: `Voice note (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')})` });
                  toast({ title: 'Voice note saved', description: 'Stored as an attachment. Transcribing…' });

                  setTranscribing(true);
                  try {
                    const formData = new FormData();
                    formData.append('audio', blob);
                    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
                      body: formData,
                    });
                    if (error) throw error;
                    if (data?.transcript && data.transcript !== '[inaudible]') {
                      setNarrative(prev => prev ? prev + '\n\n' + data.transcript : data.transcript);
                      setMode('text');
                      toast({ title: 'Transcript added', description: 'Your words have been added as editable text.' });
                    } else {
                      toast({ title: 'Audio saved', description: 'Transcription was not possible — you can add text notes manually.' });
                    }
                  } catch {
                    toast({ title: 'Audio saved', description: 'Transcription unavailable — voice note stored as an attachment.' });
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
            key="text-mode"
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
                    ? 'Your input is preserved exactly as written'
                    : 'Your input is preserved and organised into a structured record'}
                </p>
              </div>
            )}

            <div className="px-5 space-y-5">
              {/* Narrative Input */}
              <div className="writing-focus rounded-xl border border-border bg-card transition-all duration-200">
                <Label htmlFor="narrative" className="text-[13px] font-medium text-foreground/80 px-4 pt-3 block">
                  {recordType === 'daily_record' ? 'Your day' : 'Your account'}
                </Label>
                <Textarea
                  id="narrative"
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder={
                    recordType === 'daily_record'
                      ? 'Record what your day involved — interactions, work, or context'
                      : 'Write what happened — include anything said, done, or noticed.'
                  }
                  className="min-h-[180px] bg-transparent border-0 rounded-lg focus:ring-0 focus-visible:ring-0 text-[15px] leading-[1.7] shadow-none resize-none px-4"
                />
                <div className="flex items-center justify-between px-4 pb-2">
                  {narrative.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/40">{narrative.length} characters</p>
                  )}
                  <AnimatePresence>
                    {draftSaved && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-[11px] text-primary/60 font-medium ml-auto"
                      >
                        Draft saved
                      </motion.p>
                    )}
                  </AnimatePresence>
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

              {/* Attachment row */}
              <AttachmentRow
                count={allEvidence.length}
                onViewAttachments={() => setShowLibrary(true)}
              />

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
      <AttachmentsLibrary open={showLibrary} onClose={() => setShowLibrary(false)} />
    </div>
  );
};

export default RecordScreen;
