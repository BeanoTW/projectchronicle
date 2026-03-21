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
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-primary text-sm mb-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {incident.locked && <LockBanner />}

        <h1 className="text-xl font-bold text-foreground mt-2">
          {incident.title || 'Untitled incident'}
        </h1>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {incident.category && <CategoryBadge category={incident.category} />}
          <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
        </div>

        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>{format(parseISO(incident.incident_date), 'dd MMMM yyyy')}</span>
          {incident.incident_time && <><span>·</span><span>{incident.incident_time}</span></>}
          {incident.location && <><span>·</span><span>{incident.location}</span></>}
          <span>·</span>
          <span className="capitalize">{incident.status}</span>
        </div>

        {incident.excluded_from_rep && (
          <div className="mt-2 px-3 py-2 rounded-md bg-muted text-muted-foreground text-xs font-medium">
            This incident is excluded from your rep view.
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Serious Incident Flag */}
        {scoring?.seriousFlag && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive font-medium">{scoring.seriousFlagReason}</p>
          </div>
        )}

        {/* Record Strength Panel */}
        {scoring && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Record Strength</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${recordStrengthStyles[scoring.recordStrength]}`}>
                {scoring.recordStrength} record
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-muted/50 rounded px-2 py-1.5">
                <span className="text-muted-foreground">Evidence:</span> <span className="text-foreground font-medium">{scoring.evidenceStrength}</span>
              </div>
              <div className="bg-muted/50 rounded px-2 py-1.5">
                <span className="text-muted-foreground">Witnesses:</span> <span className="text-foreground font-medium">{scoring.witnessSupport}</span>
              </div>
              <div className="bg-muted/50 rounded px-2 py-1.5">
                <span className="text-muted-foreground">Detail:</span> <span className="text-foreground font-medium">{scoring.detailCompleteness}</span>
              </div>
              <div className="bg-muted/50 rounded px-2 py-1.5">
                <span className="text-muted-foreground">Occurrence:</span> <span className="text-foreground font-medium">{scoring.repeatOccurrence}</span>
              </div>
            </div>

            {scoring.strengthPrompts.length > 0 && (
              <div className="pt-2 border-t border-border space-y-1">
                {scoring.strengthPrompts.map((prompt, i) => (
                  <p key={i} className="text-[11px] text-primary">→ {prompt}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <IntegrityPanel narrative={incident.raw_narrative} savedAt={incident.created_at} />

        {incident.exact_words && (
          <div className="bg-ai-label/30 border border-ai-label-foreground/20 rounded-lg p-4">
            <p className="text-xs font-semibold text-ai-label-foreground mb-1">Exact wording recorded</p>
            <p className="text-sm text-foreground italic">"{incident.exact_words}"</p>
          </div>
        )}

        {incident.impact_note && (
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-foreground mb-1">Impact (what changed as a result)</p>
            <p className="text-sm text-body">{incident.impact_note}</p>
          </div>
        )}

        {incident.ai_summary && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="mb-2"><AILabel /></div>
            <p className="text-sm text-body">{incident.ai_summary}</p>
          </div>
        )}

        {(incident.people_involved.length > 0 || incident.witnesses.length > 0) && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            {incident.people_involved.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">People Involved</p>
                <div className="flex flex-wrap gap-1">
                  {incident.people_involved.map(p => (
                    <span key={p} className="bg-accent text-accent-foreground px-2 py-0.5 rounded-full text-xs">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {incident.witnesses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Witnesses</p>
                <div className="flex flex-wrap gap-1">
                  {incident.witnesses.map(w => (
                    <span key={w} className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evidence */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Evidence ({evidence.length})</p>
          {evidence.length === 0 ? (
            <p className="text-xs text-muted-foreground">No evidence attached yet.</p>
          ) : (
            <div className="space-y-2">
              {evidence.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                  <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center text-primary text-xs font-bold">
                    {(ev.file_type || 'F').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ev.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!incident.locked && (
            <label className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 border border-primary text-primary text-xs font-medium rounded-md cursor-pointer hover:bg-primary/5">
              <Plus className="h-3 w-3" /> Add Evidence
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
        </div>

        {/* Follow-up Notes */}
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-foreground mb-1">Follow-up Notes — Added after original record</p>
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-1">No follow-up notes yet.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {notes.map(note => (
                <div key={note.id} className="p-2 bg-muted/50 rounded-md">
                  <p className="text-[10px] text-muted-foreground">
                    Added {format(parseISO(note.created_at), 'dd MMM yyyy')} — {note.note_type}
                  </p>
                  <p className="text-xs text-body mt-1">{note.note_text}</p>
                </div>
              ))}
            </div>
          )}

          {showNoteForm ? (
            <div className="mt-3 space-y-2">
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a follow-up note..." className="min-h-[60px] bg-background text-xs" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddNote} className="text-xs">Save Note</Button>
                <Button size="sm" variant="outline" onClick={() => setShowNoteForm(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="mt-2 text-xs border-primary text-primary" onClick={() => setShowNoteForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Note
            </Button>
          )}
        </div>

        <EditHistoryPanel entries={editHistoryMapped} />

        {!incident.locked && (
          <div className="space-y-2 pt-2 pb-6">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-primary border-primary h-11" onClick={handleLock}>
                <Lock className="h-4 w-4 mr-2" /> Lock Record
              </Button>
              <Button variant="outline" className="flex-1 text-muted-foreground h-11" onClick={handleExclude}>
                <EyeOff className="h-4 w-4 mr-2" /> {incident.excluded_from_rep ? 'Include' : 'Exclude'}
              </Button>
            </div>
            <Button variant="outline" className="w-full border-destructive text-destructive h-11" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentDetailScreen;
