import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, Loader2, X, Plus, Info, ArrowLeft, ChevronLeft, ChevronRight, Trash2, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIncidents, useCreateIncident, useDeleteIncident } from '@/hooks/useIncidents';
import { useCreateEditHistory } from '@/hooks/useEditHistory';
import { useToast } from '@/hooks/use-toast';
import CategoryBadge from '@/components/chronicle/CategoryBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
  PRIMARY_CATEGORIES,
  SUBTYPES,
  CATEGORY_DEFINITIONS,
  type PrimaryCategory,
} from '@/lib/categories';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import type { Interaction, RecordType } from '@/types/dailyRecord';
import InteractionsEditor from '@/components/chronicle/InteractionsEditor';

export interface ReviewDraft {
  narrative: string;
  title: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  category: string;
  subtype: string;
  categorySource: 'ai' | 'user' | null;
  contextDomain: string;
  peopleInvolved: string[];
  witnesses: string[];
  exactWords: string;
  impactNote: string;
  aiSummary: string;
  recordMethod: string;
  categoryConfidence?: 'high' | 'medium' | 'low';
  peopleConfidence?: 'high' | 'medium' | 'low' | 'none';
  // Daily Record extension
  recordType?: RecordType;
  interactions?: Interaction[];
  // Transcript provenance — set when narrative was seeded from a transcribed audio attachment.
  transcriptProvenance?: {
    attachmentId: string;
    createdAt: string;
    provider: string;
    model: string;
  } | null;
}

function normSubtype(s: string): string {
  return s === 'Unclassified' ? 'Not sure yet' : s;
}

// === Single-incident review card ===
interface IncidentDraftCardProps {
  draft: ReviewDraft;
  category: string;
  subtype: string;
  people: string[];
  previousNames: string[];
  catConfidence: string;
  peopleConf: string;
  onCategoryChange: (c: string) => void;
  onSubtypeChange: (s: string) => void;
  onRemovePerson: (name: string) => void;
  onAddPerson: (name: string) => void;
}

// === Daily-record review card (no incident-only fields) ===
const DailyRecordDraftCard = ({ draft }: { draft: ReviewDraft }) => {
  return (
    <div className="space-y-4">
      {/* Label + date */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-muted-foreground uppercase tracking-wide">
            Daily record
          </span>
          <div className="text-right text-[12px] text-muted-foreground">
            <p className="font-medium text-foreground">{draft.incidentDate || '—'}</p>
            {draft.incidentTime && <p>{draft.incidentTime}</p>}
          </div>
        </div>
      </div>

      {/* Raw narrative */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Your account</Label>
        <p className="text-[14px] text-foreground leading-[1.7] mt-2 whitespace-pre-wrap">{draft.narrative}</p>
      </div>

      {/* Interactions (if any) */}
      {draft.interactions && draft.interactions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
            Notable interactions
          </Label>
          <InteractionsEditor interactions={draft.interactions} onChange={() => {}} readOnly />
        </div>
      )}
    </div>
  );
};

const IncidentDraftCard = ({
  draft, category, subtype, people, previousNames,
  catConfidence, peopleConf,
  onCategoryChange, onSubtypeChange, onRemovePerson, onAddPerson,
}: IncidentDraftCardProps) => {
  const [newPerson, setNewPerson] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const catDef = category ? CATEGORY_DEFINITIONS[category as PrimaryCategory] : null;

  const handleAddPersonLocal = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalised = trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    onAddPerson(normalised);
    setNewPerson('');
    setShowAddPerson(false);
  };

  return (
    <div className="space-y-4">
      {/* Narrative (read-only) */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Your account</Label>
        <p className="text-[14px] text-foreground leading-[1.7] mt-2 whitespace-pre-wrap">{draft.narrative}</p>
        {draft.exactWords && (
          <div className="mt-3 pt-3 border-t border-border">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Exact words recorded</Label>
            <p className="text-[13px] text-foreground italic leading-relaxed mt-1">"{draft.exactWords}"</p>
          </div>
        )}
      </div>

      {/* Category */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[13px] font-medium">Category</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">Used to organise your record — can be changed at any time</p>
          </div>
          {catConfidence === 'medium' && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">Review suggested</span>
          )}
          {catConfidence === 'low' && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">No strong match</span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/70">Select the closest match based on what happened</p>

        <div className="flex items-center gap-2">
          <Select value={category || '__none__'} onValueChange={(v) => onCategoryChange(v === '__none__' ? '' : v)}>
            <SelectTrigger className="rounded-lg flex-1">
              <SelectValue placeholder="Not sure yet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not sure yet</SelectItem>
              {PRIMARY_CATEGORIES.filter(c => c !== 'Other').map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>

          {catDef && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Category info">
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-[12px] leading-relaxed" side="top">
                <p className="font-medium text-foreground mb-1">{category}</p>
                <p className="text-muted-foreground">{catDef.definition}</p>
                <p className="text-muted-foreground/70 mt-1">Includes: {catDef.includes}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {category && (
          <CategoryBadge category={category} subtype={subtype !== 'Not sure yet' && subtype !== 'Unclassified' ? subtype : undefined} />
        )}

        {/* Subtype — only shown when a real category is selected */}
        {category && category !== 'Other' && SUBTYPES[category as PrimaryCategory] && (
          <div>
            <Label className="text-[11px] font-medium text-muted-foreground">Subtype</Label>
            <Select value={subtype || 'Not sure yet'} onValueChange={onSubtypeChange}>
              <SelectTrigger className="mt-1 rounded-lg">
                <SelectValue placeholder="Not sure yet" />
              </SelectTrigger>
              <SelectContent>
                {SUBTYPES[category as PrimaryCategory].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* People */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-[13px] font-medium">People involved</Label>
          {peopleConf === 'none' && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">No people detected — add if relevant</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {people.map(person => (
            <button
              key={person}
              onClick={() => onRemovePerson(person)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium bg-muted text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
            >
              {person}
              <X className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}

          {!showAddPerson && (
            <button
              onClick={() => setShowAddPerson(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>

        <AnimatePresence>
          {showAddPerson && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {previousNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {previousNames.slice(0, 8).map(name => (
                    <button
                      key={name}
                      onClick={() => handleAddPersonLocal(name)}
                      className="px-2 py-0.5 rounded-full text-[11px] bg-primary/[0.06] text-primary hover:bg-primary/15 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newPerson}
                  onChange={e => setNewPerson(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPersonLocal(newPerson); }}
                  placeholder="Name"
                  className="flex-1 h-9 rounded-lg text-[13px]"
                  autoFocus
                />
                <Button size="sm" variant="outline" onClick={() => handleAddPersonLocal(newPerson)} disabled={!newPerson.trim()} className="h-9 rounded-lg text-[12px]">Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAddPerson(false); setNewPerson(''); }} className="h-9 rounded-lg text-[12px] text-muted-foreground">Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Details */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Details</Label>
        <div className="grid grid-cols-2 gap-y-2 text-[13px]">
          <span className="text-muted-foreground">Date</span>
          <span className="text-foreground">{draft.incidentDate || '—'}</span>
          {draft.incidentTime && (<><span className="text-muted-foreground">Time</span><span className="text-foreground">{draft.incidentTime}</span></>)}
          {draft.location && (<><span className="text-muted-foreground">Location</span><span className="text-foreground">{draft.location}</span></>)}
          {draft.contextDomain && (<><span className="text-muted-foreground">Context</span><span className="text-foreground">{draft.contextDomain}</span></>)}
        </div>
      </div>
    </div>
  );
};

// === Per-draft editable state ===
interface DraftState {
  category: string;
  subtype: string;
  categorySource: 'ai' | 'user' | null;
  people: string[];
}

const ReviewScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const createIncident = useCreateIncident();
  const deleteIncident = useDeleteIncident();
  const createEditHistory = useCreateEditHistory();
  const { data: existingIncidents = [] } = useIncidents();

  const draft = (location.state?.draft as ReviewDraft | undefined) || null;
  const multiDrafts = (location.state?.multiDrafts as ReviewDraft[] | undefined) || null;
  // For post-save split: the original incident ID to replace
  const splitFromIncidentId = (location.state?.splitFromIncidentId as string | undefined) || null;

  const initialDrafts: ReviewDraft[] = multiDrafts && multiDrafts.length > 1 ? multiDrafts : draft ? [draft] : [];

  // Split mode state
  const [isSplitMode, setIsSplitMode] = useState(!!multiDrafts && multiDrafts.length > 1);
  const [splitDrafts, setSplitDrafts] = useState<ReviewDraft[] | null>(
    multiDrafts && multiDrafts.length > 1 ? multiDrafts : null
  );
  const [preSplitDraft, setPreSplitDraft] = useState<ReviewDraft | null>(draft || null);
  const [splitting, setSplitting] = useState(false);

  const drafts: ReviewDraft[] = isSplitMode && splitDrafts ? splitDrafts : initialDrafts.length > 0 ? initialDrafts : [];
  const isMulti = isSplitMode && drafts.length > 1;

  // Per-draft editable state
  const [draftStates, setDraftStates] = useState<DraftState[]>(() =>
    drafts.map(d => ({
      category: d.category || '',
      subtype: normSubtype(d.subtype || 'Not sure yet'),
      categorySource: d.categorySource ?? null,
      people: d.peopleInvolved || [],
    }))
  );
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const [activeDraft, setActiveDraft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const previousNames = useMemo(() => {
    const names = new Set<string>();
    existingIncidents.forEach(i => i.people_involved?.forEach((p: string) => names.add(p)));
    draftStates.forEach(ds => ds.people.forEach(p => names.delete(p)));
    return Array.from(names).sort();
  }, [existingIncidents, draftStates]);

  if (drafts.length === 0) {
    navigate('/record', { replace: true });
    return null;
  }

  const activeDraftsIndices = drafts.map((_, i) => i).filter(i => !removedIndices.has(i));
  const safeActive = activeDraftsIndices.includes(activeDraft)
    ? activeDraft
    : activeDraftsIndices[0] ?? 0;

  const currentDraft = drafts[safeActive];
  const currentState = draftStates[safeActive];

  if (!currentDraft || !currentState) {
    navigate('/record', { replace: true });
    return null;
  }

  const updateState = (index: number, partial: Partial<DraftState>) => {
    setDraftStates(prev => prev.map((s, i) => i === index ? { ...s, ...partial } : s));
  };

  const handleCategoryChange = (newCat: string) => {
    const validSubs = SUBTYPES[newCat as PrimaryCategory] || [];
    const currentSub = currentState.subtype;
    updateState(safeActive, {
      category: newCat,
      categorySource: 'user',
      subtype: validSubs.includes(currentSub) ? currentSub : 'Not sure yet',
    });
  };

  const handleSubtypeChange = (s: string) => {
    updateState(safeActive, {
      subtype: s,
      categorySource: currentState.categorySource === 'ai' ? 'user' : currentState.categorySource,
    });
  };

  const handleRemovePerson = (name: string) => {
    updateState(safeActive, { people: currentState.people.filter(p => p !== name) });
  };

  const handleAddPerson = (name: string) => {
    if (!currentState.people.includes(name)) {
      updateState(safeActive, { people: [...currentState.people, name] });
    }
  };

  const handleRemoveDraft = (index: number) => {
    if (activeDraftsIndices.length <= 1) return;
    setRemovedIndices(prev => new Set(prev).add(index));
    const remaining = activeDraftsIndices.filter(i => i !== index);
    if (safeActive === index) setActiveDraft(remaining[0] ?? 0);
  };

  // User-led split: trigger AI detection
  const handleSplitRequest = async () => {
    const narrativeToSplit = currentDraft.narrative;
    if (!narrativeToSplit || narrativeToSplit.length < 80) {
      toast({ title: 'Not enough content', description: 'The account needs more detail to identify separate events.' });
      return;
    }
    setSplitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-multi-incident', {
        body: { narrative: narrativeToSplit },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.is_multi || !data?.drafts?.length || data.drafts.length < 2) {
        toast({ title: 'Single event detected', description: 'No clear separation points were found in your account.' });
        return;
      }

      // Save the current single draft for "back to single record"
      setPreSplitDraft(currentDraft);

      // Build split drafts
      const newDrafts: ReviewDraft[] = data.drafts.map((d: any) => ({
        narrative: d.narrative,
        title: d.title || '',
        incidentDate: d.incident_date || currentDraft.incidentDate,
        incidentTime: d.incident_time || currentDraft.incidentTime,
        location: currentDraft.location,
        category: '',
        subtype: 'Not sure yet',
        categorySource: null,
        contextDomain: currentDraft.contextDomain,
        peopleInvolved: currentDraft.peopleInvolved || [],
        witnesses: currentDraft.witnesses || [],
        exactWords: '',
        impactNote: '',
        aiSummary: '',
        recordMethod: currentDraft.recordMethod,
      }));

      setSplitDrafts(newDrafts);
      setDraftStates(newDrafts.map(d => ({
        category: '',
        subtype: 'Not sure yet',
        categorySource: null,
        people: d.peopleInvolved || [],
      })));
      setRemovedIndices(new Set());
      setActiveDraft(0);
      setIsSplitMode(true);
    } catch (e) {
      toast({ title: 'Split unavailable', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setSplitting(false);
    }
  };

  // Revert split → single record
  const handleBackToSingle = () => {
    if (!preSplitDraft) return;
    setSplitDrafts(null);
    setIsSplitMode(false);
    setDraftStates([{
      category: preSplitDraft.category || '',
      subtype: normSubtype(preSplitDraft.subtype || 'Not sure yet'),
      categorySource: preSplitDraft.categorySource ?? null,
      people: preSplitDraft.peopleInvolved || [],
    }]);
    setRemovedIndices(new Set());
    setActiveDraft(0);
  };

  const catConfidence = currentDraft.categoryConfidence || (currentState.category ? 'high' : 'low');
  const peopleConf = currentDraft.peopleConfidence || (currentState.people.length > 0 ? 'high' : 'none');

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const idx of activeDraftsIndices) {
        const d = drafts[idx];
        const s = draftStates[idx];
        const isDaily = d.recordType === 'daily_record';
        const result = await createIncident.mutateAsync({
          raw_narrative: d.narrative,
          incident_date: d.incidentDate,
          incident_time: d.incidentTime || null,
          // Daily records also persist their event date in the canonical
          // record_date column. incident_date stays populated so existing
          // chronology / calendar / export logic keeps working unchanged.
          record_date: isDaily ? d.incidentDate : null,
          location: d.location || null,
          category: isDaily ? null : (s.category || null),
          subtype: isDaily ? null : (s.subtype || null),
          severity: null,
          people_involved: isDaily ? (d.peopleInvolved || []) : s.people,
          witnesses: d.witnesses || [],
          exact_words: d.exactWords || null,
          impact_note: d.impactNote || null,
          ai_summary: isDaily ? null : (d.aiSummary || null),
          title: d.title || null,
          record_method: d.recordMethod,
          context_domain: d.contextDomain || null,
          category_source: isDaily ? null : (s.categorySource || 'ai'),
          record_type: isDaily ? 'daily_record' : 'incident',
          interactions: isDaily ? (d.interactions ?? []) : null,
          // Transcript provenance — links narrative back to the source audio attachment.
          transcription_source_attachment_id: d.transcriptProvenance?.attachmentId ?? null,
          transcription_created_at: d.transcriptProvenance?.createdAt ?? null,
          transcription_provider: d.transcriptProvenance?.provider ?? null,
          transcription_model: d.transcriptProvenance?.model ?? null,
        } as any);
        // Best-effort: edit history is a non-critical audit trail.
        // The incident is local-first and may not yet be synced to the server,
        // so the FK insert can 409. Never let this fail the save.
        try {
          await createEditHistory.mutateAsync({
            incident_id: result.id,
            field_changed: 'incident_recorded',
            edit_source: 'system',
          });
          // If the narrative was seeded from a transcript, log that explicitly
          // so the audit trail shows where the text came from.
          if (d.transcriptProvenance) {
            await createEditHistory.mutateAsync({
              incident_id: result.id,
              field_changed: 'raw_narrative',
              new_value: `Inserted from transcribed audio (attachment ${d.transcriptProvenance.attachmentId.slice(0, 8)})`,
              edit_source: 'transcription',
            });
          }
        } catch (historyErr) {
          console.warn('[ReviewScreen] edit_history insert skipped (non-critical):', historyErr);
        }
      }

      // If this was a post-save split, delete the original incident
      if (splitFromIncidentId) {
        await deleteIncident.mutateAsync(splitFromIncidentId);
      }

      localStorage.removeItem('chronicle-draft');
      setSaved(true);
      const count = activeDraftsIndices.length;
      toast({ title: count > 1 ? `${count} records saved` : 'Record saved', description: 'Added to your timeline.' });
      setTimeout(() => navigate('/timeline'), 1200);
    } catch (e) {
      toast({ title: "Something didn't go through", description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 page-enter">
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => {
              if (splitFromIncidentId) {
                navigate(`/incident/${splitFromIncidentId}`);
              } else {
                navigate('/record', { state: { returnDraft: isMulti ? drafts[0] : currentDraft } });
              }
            }}
            className="p-1.5 -ml-1.5 text-muted-foreground/60 hover:text-foreground transition-colors rounded-lg hover:bg-muted/40"
            aria-label="Back"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
          <h1>{isMulti ? 'Review incidents' : 'Review'}</h1>
        </div>
        <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed pl-[30px]">
          {isMulti
            ? "We've identified possible separate moments — review and adjust as needed"
            : 'Review your record before saving'}
        </p>
        {isMulti && (
          <p className="text-[11px] text-muted-foreground/60 mt-1 pl-[30px]">
            Each section will be saved as a separate record if confirmed
          </p>
        )}
      </div>

      {/* Multi-incident tabs */}
      {isMulti && (
        <div className="px-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {activeDraftsIndices.map((idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveDraft(idx)}
                  className={`min-w-[36px] h-9 px-2 rounded-lg text-[13px] font-semibold transition-all ${
                    idx === safeActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {activeDraftsIndices.indexOf(idx) + 1}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-muted-foreground font-medium">
              {activeDraftsIndices.indexOf(safeActive) + 1} of {activeDraftsIndices.length}
            </span>
          </div>
        </div>
      )}

      <div className="px-5">
        {currentDraft.recordType === 'daily_record' ? (
          <DailyRecordDraftCard draft={currentDraft} />
        ) : (
          <IncidentDraftCard
            draft={currentDraft}
            category={currentState.category}
            subtype={currentState.subtype}
            people={currentState.people}
            previousNames={previousNames}
            catConfidence={catConfidence}
            peopleConf={peopleConf}
            onCategoryChange={handleCategoryChange}
            onSubtypeChange={handleSubtypeChange}
            onRemovePerson={handleRemovePerson}
            onAddPerson={handleAddPerson}
          />
        )}

        {/* Multi-incident navigation + remove */}
        {isMulti && (
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  const curPos = activeDraftsIndices.indexOf(safeActive);
                  if (curPos > 0) setActiveDraft(activeDraftsIndices[curPos - 1]);
                }}
                disabled={activeDraftsIndices.indexOf(safeActive) === 0}
                className="text-[12px] h-9 text-muted-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  const curPos = activeDraftsIndices.indexOf(safeActive);
                  if (curPos < activeDraftsIndices.length - 1) setActiveDraft(activeDraftsIndices[curPos + 1]);
                }}
                disabled={activeDraftsIndices.indexOf(safeActive) === activeDraftsIndices.length - 1}
                className="text-[12px] h-9 text-primary font-medium"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
            {activeDraftsIndices.length > 1 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => handleRemoveDraft(safeActive)}
                className="text-[12px] h-9 text-destructive/60 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            )}
          </div>
        )}

        {/* Save + secondary actions */}
        <div className="pt-6 pb-8 space-y-3">
          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full bg-primary text-primary-foreground h-12 rounded-xl text-[14px] font-semibold shadow-[var(--shadow-elevated)] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:shadow-none"
          >
            {saved ? (
              <><Check className="h-4 w-4 mr-2" /> Saved</>
            ) : saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : isMulti ? (
              `Save ${activeDraftsIndices.length} record${activeDraftsIndices.length !== 1 ? 's' : ''}`
            ) : (
              'Save record'
            )}
          </Button>

          {/* Split action — only in single mode */}
          {!isMulti && !saved && (
            <button
              onClick={handleSplitRequest}
              disabled={splitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] text-muted-foreground font-medium hover:text-foreground transition-colors disabled:opacity-40"
            >
              {splitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</>
              ) : (
                <><Scissors className="h-3.5 w-3.5" /> Split into separate records</>
              )}
            </button>
          )}

          {/* Back to single — only in split mode */}
          {isMulti && preSplitDraft && !saved && (
            <button
              onClick={handleBackToSingle}
              className="w-full text-center py-2.5 text-[13px] text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              Back to single record
            </button>
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
                <p className="text-[14px] text-primary font-semibold">
                  {activeDraftsIndices.length > 1 ? `${activeDraftsIndices.length} records saved` : 'Record saved'}
                </p>
                <p className="text-[12px] text-muted-foreground/70">Added to your timeline</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ReviewScreen;
