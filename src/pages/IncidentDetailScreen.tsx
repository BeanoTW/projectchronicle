import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Lock, EyeOff, Trash2, Plus, Shield, AlertTriangle, Archive } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { calculateScoring } from '@/lib/scoring';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const recordStrengthStyles: Record<string, string> = {
  Weak: 'text-destructive bg-destructive/8',
  Moderate: 'text-severity-serious bg-severity-serious/8',
  Strong: 'text-severity-low bg-severity-low/8',
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
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showLockedDeleteDialog, setShowLockedDeleteDialog] = useState(false);

  const scoring = useMemo(() => {
    if (!incident) return null;
    return calculateScoring(incident, allIncidents, allEvidence);
  }, [incident, allIncidents, allEvidence]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (!incident) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Incident not found.</p></div>;
  }

  const isVoided = !!incident.voided_at;

  const handleLock = async () => {
    await updateIncident.mutateAsync({ id: incident.id, locked: true });
    await createEditHistory.mutateAsync({ incident_id: incident.id, field_changed: 'record_locked' });
    toast({ title: 'Record locked' });
  };

  const handleDelete = async () => {
    if (incident.locked) {
      setShowLockedDeleteDialog(true);
      return;
    }
    await deleteIncident.mutateAsync(incident.id);
    toast({ title: 'Incident deleted' });
    navigate('/timeline');
  };

  const handleVoid = async () => {
    await updateIncident.mutateAsync({
      id: incident.id,
      voided_at: new Date().toISOString(),
      void_reason: voidReason.trim() || null,
    } as any);
    await createEditHistory.mutateAsync({
      incident_id: incident.id,
      field_changed: 'record_voided',
      new_value: voidReason.trim() || 'No reason given',
    });
    setShowVoidDialog(false);
    setVoidReason('');
    toast({ title: 'Record marked as void' });
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
    <div className="min-h-screen bg-background pb-20 page-enter">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-4 pb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-primary text-[13px] mb-3 font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {incident.locked && !isVoided && <div className="mb-3"><LockBanner /></div>}

        {isVoided && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/60 text-muted-foreground border border-border mb-3">
            <Archive className="h-4 w-4" />
            <div>
              <span className="text-sm font-medium">Voided record</span>
              {incident.void_reason && <p className="text-[12px] text-muted-foreground/70 mt-0.5">{incident.void_reason}</p>}
              <p className="text-[11px] text-muted-foreground/50">Voided {format(parseISO(incident.voided_at!), 'dd MMM yyyy')}</p>
            </div>
          </div>
        )}

        <h1 className={`text-[20px] font-bold leading-tight ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {incident.title || 'Untitled incident'}
        </h1>

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {incident.category && <CategoryBadge category={incident.category} />}
          <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
        </div>

        <div className="flex items-center gap-2 mt-2.5 text-[12px] text-muted-foreground/70">
          <span>{format(parseISO(incident.incident_date), 'dd MMMM yyyy')}</span>
          {incident.incident_time && <><span>·</span><span>{incident.incident_time}</span></>}
          {incident.location && <><span>·</span><span>{incident.location}</span></>}
          <span>·</span>
          <span className="capitalize">{incident.status}</span>
        </div>

        {incident.excluded_from_rep && (
          <div className="mt-2.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-[12px] font-medium">
            Excluded from rep view.
          </div>
        )}
      </div>

      <div className="px-5 pt-5 space-y-4">
        {/* Serious Incident Flag */}
        {scoring?.seriousFlag && (
          <div className="bg-destructive/8 border border-destructive/15 rounded-xl p-3.5 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-destructive font-medium leading-relaxed">{scoring.seriousFlagReason}</p>
          </div>
        )}

        {/* Record Strength */}
        {scoring && (
          <div>
            <p className="section-group-title">Record strength</p>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${recordStrengthStyles[scoring.recordStrength]}`}>
                  {scoring.recordStrength} record
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-foreground font-medium">
                    {scoring.evidenceStrength === 'None' ? 'No evidence attached yet' : `Evidence: ${scoring.evidenceStrength}`}
                  </span>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-foreground font-medium">
                    {scoring.witnessSupport === 'None' ? 'No witnesses recorded' : `Witnesses: ${scoring.witnessSupport}`}
                  </span>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Detail:</span> <span className="text-foreground font-medium">{scoring.detailCompleteness}</span>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2">
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
          </div>
        )}

        {/* Original Record */}
        <IntegrityPanel narrative={incident.raw_narrative} savedAt={incident.created_at} />

        {/* Exact Wording */}
        {incident.exact_words && (
          <div className="bg-ai-label/40 border border-ai-label-foreground/20 rounded-xl p-4">
            <p className="text-[12px] font-semibold text-ai-label-foreground mb-2">Exact wording recorded</p>
            <div className="border-l-[3px] border-ai-label-foreground/30 pl-3.5">
              <p className="text-[15px] text-foreground italic leading-relaxed font-medium">"{incident.exact_words}"</p>
            </div>
          </div>
        )}

        {/* Impact */}
        {incident.impact_note && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[12px] font-semibold text-foreground mb-1.5">Impact (what changed)</p>
            <p className="text-[14px] text-body leading-relaxed">{incident.impact_note}</p>
          </div>
        )}

        {/* AI Summary */}
        {incident.ai_summary && (
          <div className="bg-muted/20 border border-border/50 rounded-xl p-4">
            <div className="mb-1"><AILabel /></div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{incident.ai_summary}</p>
          </div>
        )}

        {/* People & Witnesses */}
        {(incident.people_involved.length > 0 || incident.witnesses.length > 0) && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            {incident.people_involved.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-foreground mb-1.5">People involved</p>
                <div className="flex flex-wrap gap-1.5">
                  {incident.people_involved.map(p => (
                    <span key={p} className="bg-primary/6 text-primary px-2.5 py-1 rounded text-[12px] font-medium border border-primary/12">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {incident.witnesses.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-foreground mb-1.5">Witnesses</p>
                <div className="flex flex-wrap gap-1.5">
                  {incident.witnesses.map(w => (
                    <span key={w} className="bg-muted text-muted-foreground px-2.5 py-1 rounded text-[12px] font-medium">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evidence */}
        <div>
          <p className="section-group-title">Evidence ({evidence.length})</p>
          <div className="bg-card border border-border rounded-xl p-4">
            {evidence.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No evidence added yet — you can upload screenshots, photos, or documents.</p>
            ) : (
              <div className="space-y-2">
                {evidence.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <div className="w-8 h-8 bg-primary/8 rounded-lg flex items-center justify-center text-primary text-[10px] font-bold border border-primary/12">
                      E{String(ev.evidence_ref_number || '?').padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{ev.file_name}</p>
                      <p className="text-[11px] text-muted-foreground/60">{ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!incident.locked && (
              <label className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 border border-primary/20 text-primary text-[13px] font-medium rounded-lg cursor-pointer hover:bg-primary/4 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Evidence
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            )}
          </div>
        </div>

        {/* Follow-up Notes */}
        <div>
          <p className="section-group-title">Follow-up notes</p>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground mb-2.5">Added after the original record.</p>
            {notes.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No follow-up notes yet.</p>
            ) : (
              <div className="space-y-2 mt-1">
                {notes.map(note => (
                  <div key={note.id} className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-[11px] text-muted-foreground/60">
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
              <Button variant="outline" size="sm" className="mt-3 text-[13px] border-primary/20 text-primary rounded-lg" onClick={() => setShowNoteForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
              </Button>
            )}
          </div>
        </div>

        <EditHistoryPanel entries={editHistoryMapped} />

        {!incident.locked && (
          <div className="space-y-2.5 pt-3 pb-6">
            <div className="flex gap-2.5">
              <Button variant="outline" className="flex-1 text-primary border-primary/20 h-11 rounded-xl text-[13px]" onClick={handleLock}>
                <Lock className="h-4 w-4 mr-2" /> Lock Record
              </Button>
              <Button variant="outline" className="flex-1 text-muted-foreground border-border h-11 rounded-xl text-[13px]" onClick={handleExclude}>
                <EyeOff className="h-4 w-4 mr-2" /> {incident.excluded_from_rep ? 'Include' : 'Exclude'}
              </Button>
            </div>
            <button onClick={handleDelete} className="w-full text-center py-3 text-[13px] text-destructive/60 hover:text-destructive font-medium transition-colors">
              <Trash2 className="h-4 w-4 inline mr-1.5" />Delete incident
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentDetailScreen;
