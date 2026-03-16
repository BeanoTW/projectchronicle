import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Lock, EyeOff, Trash2, Download, Share2, Plus } from 'lucide-react';
import { mockIncidents, mockEditHistory, mockEvidence, mockFollowUpNotes } from '@/data/mockData';
import SeverityBadge from '@/components/chronicle/SeverityBadge';
import CategoryBadge from '@/components/chronicle/CategoryBadge';
import RecordAgeChip from '@/components/chronicle/RecordAgeChip';
import IntegrityPanel from '@/components/chronicle/IntegrityPanel';
import EditHistoryPanel from '@/components/chronicle/EditHistoryPanel';
import AILabel from '@/components/chronicle/AILabel';
import LockBanner from '@/components/chronicle/LockBanner';
import { Button } from '@/components/ui/button';

const IncidentDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const incident = mockIncidents.find(i => i.incident_id === id);
  if (!incident) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Incident not found.</p>
      </div>
    );
  }

  const editHistory = mockEditHistory.filter(h => h.incident_id === id);
  const evidence = mockEvidence.filter(e => e.incident_id === id);
  const notes = mockFollowUpNotes.filter(n => n.incident_id === id);

  // Record strength calculation
  const strengthScore = (
    (evidence.length >= 1 ? 30 : 0) +
    (incident.witnesses.length >= 1 ? 20 : 0) +
    (notes.length >= 1 ? 20 : 0) +
    15 + // assume prompt recording for mock
    (incident.location ? 10 : 0) +
    (incident.exact_words ? 5 : 0)
  );
  const strengthLabel = strengthScore >= 80 ? 'Strong' : strengthScore >= 50 ? 'Moderate' : 'Basic';
  const strengthColor = strengthScore >= 80 ? 'text-severity-low bg-severity-low/10' : strengthScore >= 50 ? 'text-severity-serious bg-severity-serious/10' : 'text-muted-foreground bg-muted';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 pt-4 pb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-primary text-sm mb-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {incident.locked && <LockBanner />}

        <h1 className="text-xl font-bold text-foreground mt-2">
          {incident.title || 'Untitled incident'}
        </h1>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {incident.severity && <SeverityBadge severity={incident.severity} />}
          {incident.category && <CategoryBadge category={incident.category} />}
          <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${strengthColor}`}>
            Record Strength: {strengthLabel}
          </span>
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
        {/* Original Record */}
        <IntegrityPanel narrative={incident.raw_narrative} savedAt={incident.created_at} />

        {/* Exact Words */}
        {incident.exact_words && (
          <div className="bg-ai-label/30 border border-ai-label-foreground/20 rounded-lg p-4">
            <p className="text-xs font-semibold text-ai-label-foreground mb-1">Relevant wording recorded</p>
            <p className="text-sm text-foreground italic">"{incident.exact_words}"</p>
          </div>
        )}

        {/* Impact Note */}
        {incident.impact_note && (
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-foreground mb-1">How this affected you</p>
            <p className="text-sm text-body">{incident.impact_note}</p>
          </div>
        )}

        {/* AI Summary */}
        {incident.ai_summary && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="mb-2"><AILabel /></div>
            <p className="text-sm text-body">{incident.ai_summary}</p>
          </div>
        )}

        {/* People */}
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
                <div key={ev.file_id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                  <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center text-primary text-xs font-bold">
                    {ev.file_type.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ev.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">{ev.file_type} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!incident.locked && (
            <Button variant="outline" size="sm" className="mt-2 text-xs border-primary text-primary">
              <Plus className="h-3 w-3 mr-1" /> Add Evidence
            </Button>
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
                <div key={note.note_id} className="p-2 bg-muted/50 rounded-md">
                  <p className="text-[10px] text-muted-foreground">
                    Added {format(parseISO(note.created_at), 'dd MMM yyyy')} — {note.note_type}
                  </p>
                  <p className="text-xs text-body mt-1">{note.note_text}</p>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="mt-2 text-xs border-primary text-primary">
            <Plus className="h-3 w-3 mr-1" /> Add Note
          </Button>
        </div>

        {/* Edit History */}
        <EditHistoryPanel entries={editHistory} />

        {/* Actions */}
        {!incident.locked && (
          <div className="space-y-2 pt-2 pb-6">
            <Button variant="outline" className="w-full border-primary text-primary h-11">
              <Download className="h-4 w-4 mr-2" /> Export Incident
            </Button>
            <Button variant="outline" className="w-full border-primary text-primary h-11">
              <Share2 className="h-4 w-4 mr-2" /> Share With Rep
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-primary border-primary h-11">
                <Lock className="h-4 w-4 mr-2" /> Lock Record
              </Button>
              <Button variant="outline" className="flex-1 text-muted-foreground h-11">
                <EyeOff className="h-4 w-4 mr-2" /> Exclude from Rep
              </Button>
            </div>
            <Button variant="outline" className="w-full border-destructive text-destructive h-11">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentDetailScreen;
