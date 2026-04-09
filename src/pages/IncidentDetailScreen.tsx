import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, EyeOff, Trash2, Plus, Archive } from 'lucide-react';
import { useIncident, useIncidents, useUpdateIncident, useDeleteIncident } from '@/hooks/useIncidents';
import { useDevMode } from '@/contexts/DevModeContext';
import { useEditHistory, useCreateEditHistory } from '@/hooks/useEditHistory';
import { useEvidence, useUploadEvidence } from '@/hooks/useEvidence';
import { useFollowUpNotes, useCreateFollowUpNote } from '@/hooks/useFollowUpNotes';
import CategoryBadge from '@/components/chronicle/CategoryBadge';
import RecordAgeChip from '@/components/chronicle/RecordAgeChip';
import AILabel from '@/components/chronicle/AILabel';
import FollowUpDetails from '@/components/chronicle/FollowUpDetails';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const IncidentDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { devMode } = useDevMode();
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

  const followUpRef = useRef<HTMLDivElement>(null);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Record details (neutral completeness counts)
  const recordDetails = useMemo(() => {
    if (!incident) return null;
    const linkedEvidence = allEvidence.filter(e => e.incident_id === incident.id);
    return {
      attachments: linkedEvidence.length,
      followUps: notes.length,
      peopleInvolved: incident.people_involved.length,
    };
  }, [incident, allEvidence, notes]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (!incident) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Incident not found.</p></div>;
  }

  const isVoided = !!incident.voided_at;

  const handleDelete = async () => {
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

  const handleAddNote = async (note: { note_text: string; note_type: string }) => {
    await createNote.mutateAsync({ incident_id: incident.id, ...note });
    toast({ title: 'Update added' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadEvidence.mutateAsync({ file, incidentId: incident.id });
      await createEditHistory.mutateAsync({ incident_id: incident.id, field_changed: 'evidence_attached', new_value: file.name });
      toast({ title: 'Attachment uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  // Map edit history entries as "Updates"
  const updates = editHistory
    .filter(h => h.field_changed !== 'incident_recorded')
    .map(h => ({
      id: h.id,
      field_changed: h.field_changed,
      old_value: h.old_value ?? undefined,
      new_value: h.new_value ?? undefined,
      changed_at: h.changed_at,
    }))
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

  function formatUpdateAction(entry: typeof updates[0]): string {
    if (entry.field_changed === 'evidence_attached') return `Attachment added: ${entry.new_value}`;
    if (entry.field_changed === 'record_voided') return 'Record voided';
    const fieldName = entry.field_changed.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (entry.old_value && entry.new_value) return `${fieldName}: ${entry.old_value} → ${entry.new_value}`;
    if (entry.new_value) return `${fieldName} added`;
    return `${fieldName} updated`;
  }

  return (
    <div className="min-h-screen bg-background pb-20 page-enter">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-4 pb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-primary text-[13px] mb-3 font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

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
          {incident.category && <CategoryBadge category={incident.category} subtype={incident.subtype ?? undefined} />}
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
        {/* Record details (neutral completeness) */}
        {recordDetails && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[12px] font-semibold text-foreground mb-2.5">Record details</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[18px] font-bold text-foreground">{recordDetails.attachments}</p>
                <p className="text-[11px] text-muted-foreground">Attachments</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-foreground">{recordDetails.followUps}</p>
                <p className="text-[11px] text-muted-foreground">Updates</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-foreground">{recordDetails.peopleInvolved}</p>
                <p className="text-[11px] text-muted-foreground">People involved</p>
              </div>
            </div>
          </div>
        )}

        {/* Original record (structural, not status) */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[13px] font-semibold text-foreground">Original record</p>
            <p className="text-[11px] text-muted-foreground/60">
              Recorded on {format(parseISO(incident.created_at), 'dd MMMM yyyy')} at {format(parseISO(incident.created_at), 'HH:mm')}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
              {incident.raw_narrative}
            </p>
          </div>
        </div>

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

        {/* Summary */}
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
                <p className="text-[12px] font-semibold text-foreground mb-1.5">Individuals present</p>
                <div className="flex flex-wrap gap-1.5">
                  {incident.witnesses.map(w => (
                    <span key={w} className="bg-muted text-muted-foreground px-2.5 py-1 rounded text-[12px] font-medium">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachments */}
        <div>
          <p className="section-group-title">Attachments ({evidence.length})</p>
          <div className="bg-card border border-border rounded-xl p-4">
            {evidence.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No attachments added yet — you can upload screenshots, photos, or documents.</p>
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
            <label className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 border border-primary/20 text-primary text-[13px] font-medium rounded-lg cursor-pointer hover:bg-primary/4 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Attachment
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {/* Follow-up Details (always available — append-only) */}
        <div ref={followUpRef}>
          <FollowUpDetails
            notes={notes}
            originalCreatedAt={incident.created_at}
            onAddNote={handleAddNote}
            onUploadAttachment={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
          />
        </div>

        {/* Updates (replaces "Edit History") */}
        {updates.length > 0 && (
          <div>
            <p className="section-group-title">Updates ({updates.length})</p>
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              {updates.map(entry => {
                const date = parseISO(entry.changed_at);
                return (
                  <div key={entry.id} className="text-xs text-body">
                    <span className="text-muted-foreground">
                      Update added — {format(date, 'dd MMM yyyy')} at {format(date, 'HH:mm')}
                    </span>
                    {' — '}
                    {formatUpdateAction(entry)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isVoided && (
          <div className="space-y-2.5 pt-3 pb-6">
            <div className="flex gap-2.5">
              <Button variant="outline" className="flex-1 text-muted-foreground border-border h-11 rounded-xl text-[13px]" onClick={handleExclude}>
                <EyeOff className="h-4 w-4 mr-2" /> {incident.excluded_from_rep ? 'Include' : 'Exclude'}
              </Button>
              <Button variant="outline" className="flex-1 text-muted-foreground border-border h-11 rounded-xl text-[13px]" onClick={() => setShowVoidDialog(true)}>
                <Archive className="h-4 w-4 mr-2" /> Void Record
              </Button>
            </div>
            <button onClick={handleDelete} className="w-full text-center py-3 text-[13px] text-destructive/60 hover:text-destructive font-medium transition-colors">
              <Trash2 className="h-4 w-4 inline mr-1.5" />Delete incident
            </button>
          </div>
        )}

        {/* Void dialog */}
        <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
          <AlertDialogContent className="rounded-2xl mx-4">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[16px]">Mark record as void</AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] leading-relaxed">
                This record will remain in your timeline but will be clearly marked as voided. The original content will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label className="text-[12px] font-medium text-foreground">Reason (optional)</label>
              <Input
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate entry, recorded in error"
                className="text-[13px]"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-[13px]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleVoid} className="text-[13px] bg-muted-foreground hover:bg-muted-foreground/90">
                <Archive className="h-3.5 w-3.5 mr-1.5" /> Void Record
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default IncidentDetailScreen;
