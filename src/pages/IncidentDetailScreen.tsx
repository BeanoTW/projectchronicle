import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Lock, EyeOff, Trash2, Plus, Shield, AlertTriangle } from 'lucide-react';
import { useIncident, useIncidents, useUpdateIncident, useDeleteIncident } from '@/hooks/useIncidents';
import { useEditHistory, useCreateEditHistory } from '@/hooks/useEditHistory';
import { useEvidence, useUploadEvidence } from '@/hooks/useEvidence';
import { useFollowUpNotes, useCreateFollowUpNote } from '@/hooks/useFollowUpNotes';
import CategoryBadge from '@/components/chronicle/CategoryBadge';
import RecordAgeChip from '@/components/chronicle/RecordAgeChip';
import IntegrityPanel from '@/components/chronicle/IntegrityPanel';
import EditHistoryPanel from '@/components/chronicle/EditHistoryPanel';
import AILabel from '@/components/chronicle/AILabel';
import LockBanner from '@/components/chronicle/LockBanner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { calculateScoring } from '@/lib/scoring';

const recordStrengthStyles: Record<string, string> = {
  Weak: 'text-destructive bg-destructive/10',
  Moderate: 'text-severity-serious bg-severity-serious/10',
  Strong: 'text-severity-low bg-severity-low/10',
};

const IncidentDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: incident, isLoading } = useIncident(id);
  const { data: allIncidents = [] } = useIncidents();
  const { data: editHistory = [] } = useEditHistory(id);
  const { data: evidence = [] } = useEvidence(id);
  const { data: allEvidence = [] } = useEvidence();
  const { data: notes = [] } = useFollowUpNotes(id);
  const updateIncident = useUpdateIncident();
  const deleteIncident = useDeleteIncident();
  const createEditHistory = useCreateEditHistory();
  const uploadEvidence = useUploadEvidence();
  const createNote = useCreateFollowUpNote();

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('Update');

  const scoring = useMemo(() => {
    if (!incident) return null;
    return calculateScoring(incident, allIncidents, allEvidence);
  }, [incident, allIncidents, allEvidence]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (!incident) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Incident not found.</p></div>;
  }

  const handleLock = async () => {
    await updateIncident.mutateAsync({ id: incident.id, locked: true });
    await createEditHistory.mutateAsync({ incident_id: incident.id, field_changed: 'record_locked' });
    toast({ title: 'Record locked' });
  };

  const handleDelete = async () => {
    await deleteIncident.mutateAsync(incident.id);
    toast({ title: 'Incident deleted' });
    navigate('/timeline');
  };

  const handleExclude = async () => {
    await updateIncident.mutateAsync({ id: incident.id, excluded_from_rep: !incident.excluded_from_rep });
    toast({ title: incident.excluded_from_rep ? 'Included in rep view' : 'Excluded from rep view' });
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await createNote.mutateAsync({ incident_id: incident.id, note_text: noteText, note_type: noteType });
    setNoteText('');
    setShowNoteForm(false);
    toast({ title: 'Note added' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadEvidence.mutateAsync({ file, incidentId: incident.id });
      await createEditHistory.mutateAsync({ incident_id: incident.id, field_changed: 'evidence_attached', new_value: file.name });
      toast({ title: 'Evidence uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  const editHistoryMapped = editHistory.map(h => ({
    history_id: h.id,
    incident_id: h.incident_id,
    user_id: h.user_id,
    field_changed: h.field_changed,
    old_value: h.old_value ?? undefined,
    new_value: h.new_value ?? undefined,
    changed_at: h.changed_at,
  }));

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-primary text-sm mb-3 font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {incident.locked && <LockBanner />}

        <h1 className="text-xl font-bold text-foreground mt-2 leading-tight">
          {incident.title || 'Untitled incident'}
        </h1>

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {incident.category && <CategoryBadge category={incident.category} />}
          <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
        </div>

        <div className="flex items-center gap-2 mt-2.5 text-[13px] text-muted-foreground">
          <span>{format(parseISO(incident.incident_date), 'dd MMMM yyyy')}</span>
          {incident.incident_time && <><span>·</span><span>{incident.incident_time}</span></>}
          {incident.location && <><span>·</span><span>{incident.location}</span></>}
          <span>·</span>
          <span className="capitalize">{incident.status}</span>
        </div>

        {incident.excluded_from_rep && (
          <div className="mt-2.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium">
            This incident is excluded from your rep view.
          </div>
        )}
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Serious Incident Flag */}
        {scoring?.seriousFlag && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3.5 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-destructive font-medium leading-relaxed">{scoring.seriousFlagReason}</p>
          </div>
        )}

        {/* Record Strength Panel */}
        {scoring && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">Record Strength</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${recordStrengthStyles[scoring.recordStrength]}`}>
                {scoring.recordStrength} record
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Evidence:</span> <span className="text-foreground font-medium">{scoring.evidenceStrength}</span>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Witnesses:</span> <span className="text-foreground font-medium">{scoring.witnessSupport}</span>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Detail:</span> <span className="text-foreground font-medium">{scoring.detailCompleteness}</span>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Occurrence:</span> <span className="text-foreground font-medium">{scoring.repeatOccurrence}</span>
              </div>
            </div>

            {scoring.strengthPrompts.length > 0 && (
              <div className="pt-2.5 border-t border-border space-y-1.5">
                {scoring.strengthPrompts.map((prompt, i) => (
                  <p key={i} className="text-[12px] text-primary leading-relaxed">→ {prompt}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Original Record — primary section */}
        <IntegrityPanel narrative={incident.raw_narrative} savedAt={incident.created_at} />

        {/* Exact Wording */}
        {incident.exact_words && (
          <div className="bg-ai-label/30 border border-ai-label-foreground/20 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-ai-label-foreground mb-1.5">Exact wording recorded</p>
            <p className="text-[15px] text-foreground italic leading-relaxed">"{incident.exact_words}"</p>
          </div>
        )}

        {/* Impact */}
        {incident.impact_note && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <p className="text-[13px] font-semibold text-foreground mb-1.5">Impact (what changed)</p>
            <p className="text-[15px] text-body leading-relaxed">{incident.impact_note}</p>
          </div>
        )}

        {/* AI Summary — secondary/supporting */}
        {incident.ai_summary && (
          <div className="bg-muted/20 border border-border/60 rounded-xl p-4">
            <div className="mb-1"><AILabel /></div>
            <p className="text-[13px] text-body/80 leading-relaxed">{incident.ai_summary}</p>
          </div>
        )}

        {/* People & Witnesses */}
        {(incident.people_involved.length > 0 || incident.witnesses.length > 0) && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-[var(--shadow-card)]">
            {incident.people_involved.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-foreground mb-1.5">People involved</p>
                <div className="flex flex-wrap gap-1.5">
                  {incident.people_involved.map(p => (
                    <span key={p} className="bg-accent text-accent-foreground px-2.5 py-1 rounded-full text-[12px] font-medium">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {incident.witnesses.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-foreground mb-1.5">Witnesses</p>
                <div className="flex flex-wrap gap-1.5">
                  {incident.witnesses.map(w => (
                    <span key={w} className="bg-muted text-muted-foreground px-2.5 py-1 rounded-full text-[12px] font-medium">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evidence */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <p className="text-[13px] font-semibold text-foreground mb-2.5">Evidence ({evidence.length})</p>
          {evidence.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No evidence attached yet.</p>
          ) : (
            <div className="space-y-2">
              {evidence.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-[10px] font-bold">
                    E{String(ev.evidence_ref_number || '?').padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{ev.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">{ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!incident.locked && (
            <label className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 border border-primary text-primary text-[13px] font-medium rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Evidence
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
        </div>

        {/* Follow-up Notes */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
          <p className="text-[13px] font-semibold text-foreground mb-1">Follow-up notes</p>
          <p className="text-[11px] text-muted-foreground mb-2.5">Added after the original record.</p>
          {notes.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No follow-up notes yet.</p>
          ) : (
            <div className="space-y-2 mt-1">
              {notes.map(note => (
                <div key={note.id} className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-[11px] text-muted-foreground">
                    Added {format(parseISO(note.created_at), 'dd MMM yyyy')} — {note.note_type}
                  </p>
                  <p className="text-[13px] text-body mt-1 leading-relaxed">{note.note_text}</p>
                </div>
              ))}
            </div>
          )}

          {showNoteForm ? (
            <div className="mt-3 space-y-2">
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a follow-up note..." className="min-h-[60px] bg-background text-[13px]" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddNote} className="text-[13px]">Save Note</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNoteForm(false)} className="text-[13px]">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="mt-3 text-[13px] border-primary text-primary rounded-xl" onClick={() => setShowNoteForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
            </Button>
          )}
        </div>

        <EditHistoryPanel entries={editHistoryMapped} />

        {!incident.locked && (
          <div className="space-y-2.5 pt-3 pb-6">
            <div className="flex gap-2.5">
              <Button variant="outline" className="flex-1 text-primary border-primary h-11 rounded-xl" onClick={handleLock}>
                <Lock className="h-4 w-4 mr-2" /> Lock Record
              </Button>
              <Button variant="outline" className="flex-1 text-muted-foreground h-11 rounded-xl" onClick={handleExclude}>
                <EyeOff className="h-4 w-4 mr-2" /> {incident.excluded_from_rep ? 'Include' : 'Exclude'}
              </Button>
            </div>
            <Button variant="outline" className="w-full border-destructive text-destructive h-11 rounded-xl" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentDetailScreen;
