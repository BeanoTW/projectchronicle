import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Keyboard, ChevronRight, ChevronDown, Loader2, AlertTriangle, Check, Heart, Trash2, Paperclip } from 'lucide-react';
import { detectCoherence } from '@/lib/coherence';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useDevMode } from '@/contexts/DevModeContext';
import { useIncidents, useCreateIncident, useDeleteIncident } from '@/hooks/useIncidents';
import { useCreateEditHistory } from '@/hooks/useEditHistory';
import { useToast } from '@/hooks/use-toast';
import AILabel from '@/components/chronicle/AILabel';
import SplitIncidentModal, { type IncidentDraft } from '@/components/chronicle/SplitIncidentModal';
import PageHeader from '@/components/chronicle/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceRecorder from '@/components/chronicle/VoiceRecorder';
import { useUploadEvidence, useEvidence } from '@/hooks/useEvidence';
import AttachmentRow from '@/components/chronicle/AttachmentRow';
import AttachmentsLibrary from '@/components/chronicle/AttachmentsLibrary';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { PRIMARY_CATEGORIES, SUBTYPES, type PrimaryCategory } from '@/lib/categories';

const categories = [...PRIMARY_CATEGORIES];

const RecordScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { devMode, toggleDevMode } = useDevMode();
  const { data: existingIncidents = [] } = useIncidents();
  const createIncident = useCreateIncident();
  const deleteIncident = useDeleteIncident();
  const createEditHistory = useCreateEditHistory();
  const { toast } = useToast();
  const uploadEvidence = useUploadEvidence();
  const { data: allEvidence = [] } = useEvidence();
  const [transcribing, setTranscribing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const [mode, setMode] = useState<'voice' | 'text'>('text');
  const [showManualForm, setShowManualForm] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<string>('');
  const [subtype, setSubtype] = useState<string>('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [exactWords, setExactWords] = useState('');
  const [impactNote, setImpactNote] = useState('');
  const [title, setTitle] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiRelevance, setAiRelevance] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitHighlights, setSplitHighlights] = useState<string[]>([]);
  const [splitDrafts, setSplitDrafts] = useState<IncidentDraft[]>([]);
  const [splitCount, setSplitCount] = useState(1);
  const [splitChecked, setSplitChecked] = useState(false);
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
        narrative, incidentDate, incidentTime, location, category, subtype,
        peopleInvolved, witnesses, exactWords, impactNote, title,
        // NEVER store: aiSummary, aiRelevance, aiSuggested — these are analysis/preview only
      }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    }
  }, [narrative, incidentDate, incidentTime, location, category, peopleInvolved, witnesses, exactWords, impactNote, title]);

  // Load draft on mount — ONLY user-entered fields, never analysis/AI output
  useEffect(() => {
    const stored = localStorage.getItem('chronicle-draft');
    if (stored) {
      try {
        const draft = JSON.parse(stored);
        if (draft.narrative) setNarrative(draft.narrative);
        if (draft.incidentDate) setIncidentDate(draft.incidentDate);
        if (draft.incidentTime) setIncidentTime(draft.incidentTime);
        if (draft.location) setLocation(draft.location);
        if (draft.category) setCategory(draft.category);
        if (draft.peopleInvolved) setPeopleInvolved(draft.peopleInvolved);
        if (draft.witnesses) setWitnesses(draft.witnesses);
        if (draft.exactWords) setExactWords(draft.exactWords);
        if (draft.impactNote) setImpactNote(draft.impactNote);
        if (draft.title) setTitle(draft.title);
        // NEVER restore AI-derived fields: aiSummary, aiRelevance, aiSuggested
      } catch { /* ignore */ }
    }
  }, []);

  // DRAFT LEAKAGE PREVENTION: Clear all temporary state on unmount
  useEffect(() => {
    return () => {
      // Clear analysis/preview state — these must never persist
      setAiSummary('');
      setAiRelevance([]);
      setAiSuggested(false);
      setSplitDrafts([]);
      setSplitHighlights([]);
      setSplitChecked(false);
    };
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

  const similarPatternAlert = useMemo(() => {
    if (existingIncidents.length < 2) return null;
    if (category) {
      const sameCategory = existingIncidents.filter(i => i.category === category).length;
      if (sameCategory >= 2) return `${sameCategory} previous incidents recorded under "${category}".`;
    }
    const people = peopleInvolved.split(',').map(s => s.trim()).filter(Boolean);
    for (const person of people) {
      const count = existingIncidents.filter(i => i.people_involved.some(p => p.toLowerCase() === person.toLowerCase())).length;
      if (count >= 2) return `${person} appears in ${count} previous incidents.`;
    }
    return null;
  }, [category, peopleInvolved, existingIncidents]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!narrative.trim()) newErrors.raw_narrative = 'Please enter your account of the incident.';
    if (!incidentDate) newErrors.incident_date = 'Please select the incident date.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAnalyse = async () => {
    if (!narrative.trim()) {
      setErrors({ raw_narrative: 'Please enter your account first.' });
      return;
    }
    setAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyse-incident', {
        body: { narrative, existingPatterns: existingPatterns.length > 0 ? existingPatterns : undefined },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (data.incident_date && !incidentDate) setIncidentDate(data.incident_date);
      if (data.incident_time && !incidentTime) setIncidentTime(data.incident_time);
      if (data.location && !location) setLocation(data.location);
      if (data.category && !category) setCategory(data.category);
      if (data.subtype && !subtype) setSubtype(data.subtype);
      if (data.people_involved?.length && !peopleInvolved) setPeopleInvolved(data.people_involved.join(', '));
      if (data.exact_words && !exactWords) setExactWords(data.exact_words);
      if (data.summary) setAiSummary(data.summary);
      if (data.title && !title) setTitle(data.title);
      if (data.potential_relevance?.length) setAiRelevance(data.potential_relevance);
      setAiSuggested(true);
      setShowManualForm(false);
      setMoreDetailsOpen(false);
      toast({ title: 'Summary created', description: 'Review and adjust anything before saving.' });
    } catch (e) {
      toast({ title: "Something didn't go through", description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setAnalysing(false);
    }
  };

  const handleDetectMulti = async () => {
    if (!narrative.trim() || narrative.length < 80 || splitChecked) return;
    try {
      const { data, error } = await supabase.functions.invoke('detect-multi-incident', {
        body: { narrative },
      });
      if (error || data?.error) return;
      setSplitChecked(true);
      if (data.is_multi && data.confidence !== 'low') {
        setSplitHighlights(data.highlight_phrases || []);
        setSplitDrafts(data.drafts || []);
        setSplitCount(data.suggested_count || 2);
        setSplitModalOpen(true);
      }
    } catch {
      // Silent fail — splitting is optional
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const result = await createIncident.mutateAsync({
        raw_narrative: narrative,
        incident_date: incidentDate,
        incident_time: incidentTime || null,
        location: location || null,
        category: category || null,
        subtype: subtype || null,
        severity: null,
        people_involved: peopleInvolved ? peopleInvolved.split(',').map(s => s.trim()).filter(Boolean) : [],
        witnesses: witnesses ? witnesses.split(',').map(s => s.trim()).filter(Boolean) : [],
        exact_words: exactWords || null,
        impact_note: impactNote || null,
        ai_summary: aiSummary || null,
        title: title || null,
        record_method: mode,
      });
      await createEditHistory.mutateAsync({
        incident_id: result.id,
        field_changed: 'incident_recorded',
      });
      localStorage.removeItem('chronicle-draft');
      setSaved(true);
      toast({ title: 'Record saved', description: 'You can add attachments to this later.' });
      setTimeout(() => navigate('/timeline'), 1200);
    } catch (e) {
      toast({ title: "Something didn't go through", description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSplit = async (drafts: IncidentDraft[]) => {
    setSplitModalOpen(false);
    setSaving(true);
    try {
      for (const draft of drafts) {
        const result = await createIncident.mutateAsync({
          raw_narrative: draft.narrative,
          incident_date: draft.incident_date || incidentDate,
          incident_time: draft.incident_time || null,
          title: draft.title || null,
          record_method: 'text',
        });
        await createEditHistory.mutateAsync({
          incident_id: result.id,
          field_changed: 'incident_recorded',
        });
      }
      localStorage.removeItem('chronicle-draft');
      toast({ title: `${drafts.length} incidents saved`, description: 'Your entry has been split and added to your timeline.' });
      navigate('/timeline');
    } catch (e) {
      toast({ title: "Something didn't go through", description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (resetConfirmText !== 'RESET') return;
    setResetting(true);
    try {
      // Delete all evidence files from storage
      const { data: evidenceFiles } = await supabase.from('evidence_files').select('file_path');
      if (evidenceFiles?.length) {
        await supabase.storage.from('evidence').remove(evidenceFiles.map(f => f.file_path));
      }
      // Delete all evidence records
      await supabase.from('evidence_files').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Delete all follow-up notes
      await supabase.from('follow_up_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Delete all edit history
      await supabase.from('edit_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Delete all incidents
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
  const canSave = hasText && !!incidentDate;

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
        <Label className="text-[13px] font-medium">Category</Label>
        <Select value={category} onValueChange={(v) => { setCategory(v); setSubtype(''); }}>
          <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {category && SUBTYPES[category as PrimaryCategory] && (
        <div>
          <Label className="text-[13px] font-medium">Subtype</Label>
          <Select value={subtype} onValueChange={setSubtype}>
            <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Select subtype" /></SelectTrigger>
            <SelectContent>
              {SUBTYPES[category as PrimaryCategory].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
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
        subtitle="Take your time — write this in your own words."
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

      {/* Mode Toggle */}
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

            {/* Helper chips for voice context */}
            {!hasText && (
              <div className="px-5 mt-2 mb-4">
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed text-center">
                  You don't need to get this perfect
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
                    <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">When</span>
                    <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">Where</span>
                    <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">Who</span>
                    <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">What happened</span>
                    <span className="bg-muted/40 px-2.5 py-1 rounded whitespace-nowrap">What was said</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed text-center">
                  You don't need to get this perfect
                </p>
              </div>
            )}

            {/* Pattern Alert */}
            {similarPatternAlert && (
              <div className="mx-5 mb-4 px-4 py-3.5 rounded-xl bg-warm-accent/[0.08] border border-warm-accent/25 flex items-start gap-2.5 shadow-sm animate-fade-in">
                <div className="w-6 h-6 rounded-full bg-warm-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-warm-accent" />
                </div>
                <div>
                  <p className="text-[13px] text-warm-accent-foreground font-semibold leading-snug">
                    {similarPatternAlert.replace('incidents', 'records')}
                  </p>
                  <p className="text-[11px] text-warm-accent-foreground/60 mt-0.5">Pattern detected from your existing records</p>
                </div>
              </div>
            )}

            <div className="px-5 space-y-5">
              {/* Narrative Input */}
              <div className="writing-focus rounded-xl border border-border bg-card transition-all duration-200">
                <Label htmlFor="narrative" className="text-[13px] font-medium text-foreground/80 px-4 pt-3 block">
                  Your account
                </Label>
                <Textarea
                  id="narrative"
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Write what happened — include anything said, done, or noticed."
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

              {/* Attachment row — primary entry point */}
              <AttachmentRow
                count={allEvidence.filter(e => !e.incident_id).length + allEvidence.filter(e => !!e.incident_id).length}
                onViewAttachments={() => setShowLibrary(true)}
              />

              {/* Reassurance text */}
              {hasText && !aiSuggested && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-muted-foreground/60 text-center -mt-2"
                >
                  Approximate is fine · You can edit this later
                </motion.p>
              )}

              {/* Smart CTA — coherence-aware */}
              {hasText && !aiSuggested && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-2"
                >
                  {isCoherent ? (
                    <>
                      <Button
                        className="w-full rounded-xl h-12 text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition-all"
                        onClick={async () => {
                          handleDetectMulti();
                          await handleAnalyse();
                          // After analysis extracts date, save will be available in post-analysis section
                        }}
                        disabled={analysing || saving}
                      >
                        {analysing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Structuring your record…</>
                        ) : (
                          'Save record'
                        )}
                      </Button>
                      <button
                        onClick={() => { handleAnalyse(); handleDetectMulti(); }}
                        disabled={analysing}
                        className="w-full text-center py-2 text-[13px] text-primary/70 font-medium hover:text-primary transition-colors disabled:opacity-40"
                      >
                        {analysing ? 'Structuring…' : 'Improve structure first'}
                      </button>
                    </>
                  ) : (
                    <>
                      <Button
                        className="w-full rounded-xl h-12 text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition-all"
                        onClick={() => { handleAnalyse(); handleDetectMulti(); }}
                        disabled={analysing}
                      >
                        {analysing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Structuring your record…</>
                        ) : (
                          'Structure this for you'
                        )}
                      </Button>
                      <button
                        onClick={() => {
                          if (!incidentDate) {
                            setErrors({ incident_date: 'Please add a date before saving.' });
                            setShowManualForm(true);
                            setMoreDetailsOpen(true);
                            return;
                          }
                          handleSave();
                        }}
                        disabled={saving}
                        className="w-full text-center py-2 text-[13px] text-muted-foreground/60 font-medium hover:text-muted-foreground transition-colors disabled:opacity-40"
                      >
                        Save as is
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {/* === POST-ANALYSIS SECTION === */}
              {aiSuggested && (
                <motion.div
                  className="space-y-5"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  {aiSummary && (
                    <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
                      <div className="mb-1"><AILabel /></div>
                       <p className="text-[12px] text-muted-foreground mb-2">Review before saving</p>
                      <p className="text-[14px] text-body leading-[1.7]">{aiSummary}</p>
                      <button
                        onClick={() => { setAiSummary(''); setAiSuggested(false); setAiRelevance([]); }}
                        className="text-[12px] text-destructive/60 mt-3 font-medium hover:text-destructive transition-colors"
                      >
                        Remove summary
                      </button>
                    </div>
                  )}

                  {aiRelevance.length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
                      <h3 className="text-[12px] font-semibold text-foreground mb-2">Related context</h3>
                      <div className="mb-1"><AILabel /></div>
                      <div className="space-y-2">
                        {aiRelevance.map((r, i) => (
                          <p key={i} className="text-[13px] text-body leading-relaxed">{r}</p>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground/40 mt-2.5">Not legal advice. Neutral observations only.</p>
                    </div>
                  )}

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="date" className="text-[13px] font-medium">Date *</Label>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1">Approximate is fine</p>
                      <Input id="date" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="rounded-lg" />
                      {errors.incident_date && <p className="text-[12px] text-destructive mt-1">{errors.incident_date}</p>}
                    </div>
                    <div>
                      <Label htmlFor="time" className="text-[13px] font-medium">Time</Label>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1">Approximate is fine</p>
                      <Input id="time" type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} className="rounded-lg" />
                    </div>
                  </div>

                  <Collapsible open={showManualForm || moreDetailsOpen} onOpenChange={(open) => { setMoreDetailsOpen(open); if (open) setShowManualForm(true); }}>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-[13px] text-primary font-medium py-1 transition-all">
                      {showManualForm || moreDetailsOpen ? (
                        <><ChevronDown className="h-4 w-4 transition-transform duration-200" /> Hide details</>
                      ) : (
                        <><ChevronRight className="h-4 w-4 transition-transform duration-200" /> Fill in manually</>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                      {detailFields}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Save */}
                  <div className="pt-4 pb-8">
                    <Button
                      onClick={handleSave}
                      disabled={saving || saved || !canSave}
                      className="w-full bg-primary text-primary-foreground h-12 rounded-xl text-[14px] font-semibold shadow-[var(--shadow-elevated)] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:shadow-none"
                    >
                      {saved ? (
                        <><Check className="h-4 w-4 mr-2" /> Saved</>
                      ) : saving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        'Save record'
                      )}
                    </Button>
                    {!canSave && hasText && !incidentDate && (
                      <p className="text-[11px] text-muted-foreground/60 text-center mt-2">Add a date to save this record</p>
                    )}
                    <AnimatePresence>
                      {saved && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35 }}
                          className="mt-4 text-center space-y-1"
                        >
                          <p className="text-[14px] text-primary font-semibold">Record saved</p>
                          <p className="text-[12px] text-muted-foreground/70">Added to your timeline · You can add evidence at any time</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* Fallback manual path */}
              {!aiSuggested && hasText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Collapsible open={showManualForm || moreDetailsOpen} onOpenChange={(open) => { setMoreDetailsOpen(open); if (open) setShowManualForm(true); }}>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-[13px] text-muted-foreground font-medium py-1 transition-all">
                      {showManualForm || moreDetailsOpen ? (
                        <><ChevronDown className="h-4 w-4 transition-transform duration-200" /> Hide details</>
                      ) : (
                        <><ChevronRight className="h-4 w-4 transition-transform duration-200" /> Fill in manually instead</>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                      <div className="space-y-5 mt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="date-manual" className="text-[13px] font-medium">Date *</Label>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1">Approximate is fine</p>
                            <Input id="date-manual" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="rounded-lg" />
                            {errors.incident_date && <p className="text-[12px] text-destructive mt-1">{errors.incident_date}</p>}
                          </div>
                          <div>
                            <Label htmlFor="time-manual" className="text-[13px] font-medium">Time</Label>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-1">Approximate is fine</p>
                            <Input id="time-manual" type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} className="rounded-lg" />
                          </div>
                        </div>
                        {detailFields}
                        <div className="pt-4 pb-8">
                          <Button
                            onClick={handleSave}
                            disabled={saving || saved || !canSave}
                            className="w-full bg-primary text-primary-foreground h-12 rounded-xl text-[14px] font-semibold shadow-[var(--shadow-elevated)] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:shadow-none"
                          >
                            {saved ? (
                              <><Check className="h-4 w-4 mr-2" /> Saved</>
                            ) : saving ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                            ) : (
                              'Save record'
                            )}
                          </Button>
                          {!canSave && hasText && !incidentDate && (
                            <p className="text-[11px] text-muted-foreground/60 text-center mt-2">Add a date to save this record</p>
                          )}
                          <AnimatePresence>
                            {saved && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.35 }}
                                className="mt-4 text-center space-y-1"
                              >
                                <p className="text-[14px] text-primary font-semibold">Record saved</p>
                                <p className="text-[12px] text-muted-foreground/70">Added to your timeline · You can add evidence at any time</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reassurance footer with long-press dev mode trigger */}
      <div className="mt-3 mb-28 mx-5 py-3 px-4 rounded-xl bg-muted/30 backdrop-blur-sm text-center space-y-0.5">
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          {saved
            ? 'Saved · You can come back anytime'
            : hasText
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

      <SplitIncidentModal
        open={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        narrative={narrative}
        highlights={splitHighlights}
        suggestedCount={splitCount}
        drafts={splitDrafts}
        onKeepSingle={() => setSplitModalOpen(false)}
        onSaveSplit={handleSaveSplit}
      />

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
