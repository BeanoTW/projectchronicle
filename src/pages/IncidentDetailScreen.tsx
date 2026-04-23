import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ArrowLeft, EyeOff, Trash2, Plus, Archive, Scissors, Info } from 'lucide-react';
import { useIncident, useIncidents, useUpdateIncident, useDeleteIncident } from '@/hooks/useIncidents';
import { useDevMode } from '@/contexts/DevModeContext';
import { useEditHistory, useCreateEditHistory } from '@/hooks/useEditHistory';
import { useBackup } from '@/contexts/BackupContext';
import { useEvidence, useUploadEvidence } from '@/hooks/useEvidence';
import { useFollowUpNotes, useCreateFollowUpNote } from '@/hooks/useFollowUpNotes';
import CategoryBadge from '@/components/chronicle/CategoryBadge';
import RecordTypeLabel from '@/components/chronicle/RecordTypeLabel';
import FollowUpDetails from '@/components/chronicle/FollowUpDetails';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { usePrivacy } from '@/contexts/PrivacyContext';
import ObscuredBlock from '@/components/chronicle/ObscuredBlock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function fmtFull(dateStr: string): string {
  try { return format(parseISO(dateStr), 'dd MMMM yyyy, HH:mm'); } catch { return dateStr; }
}
function fmtDate(dateStr: string): string {
  try { return format(parseISO(dateStr), 'dd MMMM yyyy'); } catch { return dateStr; }
}

const IncidentDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { maskText, maskName, maskFilename } = usePrivacy();
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
  const { resolveConflictKeepLocal, resolveConflictKeepCloud } = useBackup();
  const [resolvingConflict, setResolvingConflict] = useState(false);

  const followUpRef = useRef<HTMLDivElement>(null);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (!incident) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Incident not found.</p></div>;
  }

  const isVoided = !!incident.voided_at;
  const isDaily = incident.record_type === 'daily_record';
  const interactionsRaw = (incident as any).interactions;
  const interactions = Array.isArray(interactionsRaw) ? interactionsRaw : [];
  // Daily records use record_date as their canonical event date.
  // Incidents use incident_date. Fall back to the other if missing.
  const eventDate =
    (isDaily ? (incident as any).record_date : incident.incident_date)
    || incident.incident_date
    || (incident as any).record_date;
  const retroGap = (() => {
    try {
      const gap = differenceInCalendarDays(parseISO(incident.created_at), parseISO(eventDate));
      return gap > 0 ? `Recorded ${gap} day${gap === 1 ? '' : 's'} after event` : null;
    } catch { return null; }
  })();

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

  const handleCategoryUpdate = async (newCategory: string) => {
    const cat = newCategory === '__none__' ? null : newCategory;
    // Reset subtype if category changed and subtype is incompatible
    const validSubs = cat ? (SUBTYPES[cat as PrimaryCategory] || []) : [];
    const currentSub = incident.subtype;
    const newSubtype = validSubs.includes(currentSub || '') ? currentSub : null;
    const oldCat = incident.category ?? '';

    await updateIncident.mutateAsync({
      id: incident.id,
      category: cat,
      subtype: newSubtype,
      category_source: 'user',
    } as any);
    // Audit trail (best-effort — append-only at the DB layer)
    try {
      if (oldCat !== (cat ?? '')) {
        await createEditHistory.mutateAsync({
          incident_id: incident.id,
          field_changed: 'category',
          old_value: oldCat || '(none)',
          new_value: cat ?? '(none)',
          edit_source: 'user',
        });
      }
    } catch (e) {
      console.warn('[IncidentDetail] edit_history insert skipped:', e);
    }
    toast({ title: 'Category updated' });
  };

  const handleSubtypeUpdate = async (newSubtype: string) => {
    const oldSub = incident.subtype ?? '';
    const next = newSubtype === 'Not sure yet' ? null : newSubtype;
    await updateIncident.mutateAsync({
      id: incident.id,
      subtype: next,
    } as any);
    try {
      if (oldSub !== (next ?? '')) {
        await createEditHistory.mutateAsync({
          incident_id: incident.id,
          field_changed: 'subtype',
          old_value: oldSub || '(none)',
          new_value: next ?? '(none)',
          edit_source: 'user',
        });
      }
    } catch (e) {
      console.warn('[IncidentDetail] edit_history insert skipped:', e);
    }
    toast({ title: 'Subtype updated' });
  };

  const handlePostSaveSplit = () => {
    navigate('/review', {
      state: {
        draft: {
          narrative: incident.raw_narrative,
          title: incident.title || '',
          incidentDate: incident.incident_date,
          incidentTime: incident.incident_time || '',
          location: incident.location || '',
          category: incident.category || '',
          subtype: incident.subtype || 'Not sure yet',
          categorySource: incident.category_source as 'ai' | 'user' | null,
          contextDomain: incident.context_domain || '',
          peopleInvolved: incident.people_involved || [],
          witnesses: incident.witnesses || [],
          exactWords: incident.exact_words || '',
          impactNote: incident.impact_note || '',
          aiSummary: incident.ai_summary || '',
          recordMethod: incident.record_method || 'text',
        },
        splitFromIncidentId: incident.id,
      },
    });
  };

  const updates = editHistory
    .filter(h => h.field_changed !== 'incident_recorded')
    .map(h => ({ id: h.id, field_changed: h.field_changed, old_value: h.old_value ?? undefined, new_value: h.new_value ?? undefined, changed_at: h.changed_at }))
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

  function formatUpdateAction(entry: typeof updates[0]): string {
    if (entry.field_changed === 'evidence_attached') return `Attachment added: ${entry.new_value}`;
    if (entry.field_changed === 'record_voided') return 'Record voided';
    const fieldName = entry.field_changed.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (entry.old_value && entry.new_value) return `${fieldName}: ${entry.old_value} → ${entry.new_value}`;
    if (entry.new_value) return `${fieldName} added`;
    return `${fieldName} updated`;
  }

  const catDef = incident.category ? CATEGORY_DEFINITIONS[incident.category as PrimaryCategory] : null;

  return (
    <div className="min-h-screen bg-background pb-20 page-enter">
      {/* Nav */}
      <div className="bg-card border-b border-border px-5 pt-4 pb-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-primary text-[13px] font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="px-5 pt-5 space-y-4">
        {/* Sync conflict banner */}
        {(incident as { sync_state?: string }).sync_state === 'conflict' && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
            <div>
              <p className="text-[14px] font-semibold text-foreground">This record was changed elsewhere.</p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                Another device updated this record after this device last synced. Choose which version to keep. The other version will be discarded.
              </p>
              {(incident as { cloud_last_modified_at?: string | null }).cloud_last_modified_at && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Other device last modified: {fmtFull((incident as { cloud_last_modified_at: string }).cloud_last_modified_at)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={resolvingConflict}
                onClick={async () => {
                  setResolvingConflict(true);
                  try {
                    await resolveConflictKeepLocal(incident.id);
                    toast({ title: 'Kept this device\'s version' });
                  } catch (e) {
                    toast({ title: 'Could not resolve', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
                  } finally { setResolvingConflict(false); }
                }}
              >
                Keep this version
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={resolvingConflict}
                onClick={async () => {
                  setResolvingConflict(true);
                  try {
                    await resolveConflictKeepCloud(incident.id);
                    toast({ title: 'Replaced with the other device\'s version' });
                  } catch (e) {
                    toast({ title: 'Could not resolve', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
                  } finally { setResolvingConflict(false); }
                }}
              >
                Use other version
              </Button>
            </div>
          </div>
        )}

        {/* Voided banner */}
        {isVoided && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/60 text-muted-foreground border border-border">
            <Archive className="h-4 w-4" />
            <div>
              <span className="text-sm font-medium">Voided record</span>
              {incident.void_reason && <p className="text-[12px] text-muted-foreground/70 mt-0.5">{incident.void_reason}</p>}
              <p className="text-[11px] text-muted-foreground/50">Voided on {fmtFull(incident.voided_at!)}</p>
            </div>
          </div>
        )}

        {/* === INCIDENT CARD === */}
        <div className={`bg-card border border-border rounded-xl overflow-hidden ${isVoided ? 'opacity-50' : ''} ${isDaily ? 'opacity-90' : ''}`}>

          {/* 1. HEADER */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[12px] text-muted-foreground font-medium">{incident.id.slice(0, 8).toUpperCase()}</p>
                <RecordTypeLabel recordType={incident.record_type} />
                {!isDaily && incident.category && (
                  <span className="text-[11px] text-muted-foreground">{incident.category}{incident.subtype && incident.subtype !== incident.category ? ` — ${incident.subtype}` : ''}</span>
                )}
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-foreground">{fmtDate(eventDate)}</p>
                {incident.incident_time && <p className="text-[12px] text-muted-foreground">{incident.incident_time}</p>}
              </div>
            </div>
          </div>

          {/* 2. META */}
          <div className="px-4 py-2.5 border-b border-border/50 text-[12px] text-muted-foreground space-y-0.5">
            <p>Recorded: {fmtFull(incident.created_at)}</p>
            {retroGap && <p className="text-muted-foreground/70">{retroGap}</p>}
            {incident.location && <p>{maskText(incident.location)}</p>}
          </div>

          <div className="px-4 py-3 space-y-4">
            {/* 3. PEOPLE INVOLVED — incidents only */}
            {!isDaily && incident.people_involved.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">People involved</p>
                <div className="flex flex-wrap gap-1.5">
                  {incident.people_involved.map(p => (
                    <span key={p} className="bg-primary/6 text-primary px-2.5 py-1 rounded text-[12px] font-medium border border-primary/12">{maskName(p)}</span>
                  ))}
                </div>
              </div>
            )}

            {!isDaily && incident.witnesses.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Individuals present</p>
                <div className="flex flex-wrap gap-1.5">
                  {incident.witnesses.map(w => (
                    <span key={w} className="bg-muted text-muted-foreground px-2.5 py-1 rounded text-[12px] font-medium">{maskName(w)}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 4. CLASSIFICATION — incidents only */}
            {!isDaily && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">Classification</p>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Select
                    value={incident.category || '__none__'}
                    onValueChange={handleCategoryUpdate}
                  >
                    <SelectTrigger className="rounded-lg flex-1 h-9 text-[13px]">
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
                        <button className="p-1 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Category info">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-[12px] leading-relaxed" side="top">
                        <p className="font-medium text-foreground mb-1">{incident.category}</p>
                        <p className="text-muted-foreground">{catDef.definition}</p>
                        <p className="text-muted-foreground/70 mt-1">Includes: {catDef.includes}</p>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Subtype */}
                {incident.category && incident.category !== 'Other' && SUBTYPES[incident.category as PrimaryCategory] && (
                  <Select
                    value={incident.subtype || 'Not sure yet'}
                    onValueChange={handleSubtypeUpdate}
                  >
                    <SelectTrigger className="rounded-lg h-9 text-[13px] mt-1">
                      <SelectValue placeholder="Not sure yet" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBTYPES[incident.category as PrimaryCategory].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <p className="text-[10px] text-muted-foreground/50 mt-1">Can be updated at any time</p>
              </div>
            )}

            {/* 5. RAW NARRATIVE (primary) */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                {isDaily ? 'Account of the day' : 'User-provided account'}
              </p>
              <ObscuredBlock>
                <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {incident.raw_narrative}
                </p>
              </ObscuredBlock>
            </div>

            {/* 5b. INTERACTIONS — daily only */}
            {isDaily && interactions.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Notable interactions</p>
                <div className="space-y-1">
                  {interactions.map((it: any, i: number) => (
                    <div key={i} className="text-[13px] text-foreground leading-relaxed">
                      <span className="text-muted-foreground/70">{it.time ? `${it.time} — ` : ''}</span>
                      <span className="font-medium">{it.type}</span>
                      {it.who ? <span> — {maskName(it.who)}</span> : null}
                      {it.context ? <span className="text-muted-foreground"> — {maskText(it.context)}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. EXACT WORDS — incidents only */}
            {!isDaily && incident.exact_words && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Exact words</p>
                <ObscuredBlock>
                  <div className="border-l-[3px] border-muted-foreground/20 pl-3.5">
                    <p className="text-[14px] text-foreground italic leading-relaxed">"{incident.exact_words}"</p>
                  </div>
                </ObscuredBlock>
              </div>
            )}

            {/* Impact — incidents only */}
            {!isDaily && incident.impact_note && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Impact</p>
                <ObscuredBlock>
                  <p className="text-[13px] text-foreground leading-relaxed">{incident.impact_note}</p>
                </ObscuredBlock>
              </div>
            )}

            {/* 7. FOLLOW-UPS */}
            <div ref={followUpRef}>
              <FollowUpDetails
                notes={notes}
                originalCreatedAt={incident.created_at}
                onAddNote={handleAddNote}
                onUploadAttachment={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              />
            </div>

            {/* 8. EVIDENCE */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Evidence ({evidence.length})</p>
              {evidence.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/60">No attachments added yet.</p>
              ) : (
                <div className="space-y-2">
                  {evidence.map(ev => (
                    <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                      <div className="w-8 h-8 bg-primary/8 rounded-lg flex items-center justify-center text-primary text-[10px] font-bold border border-primary/12">
                        E{String(ev.evidence_ref_number || '?').padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{maskFilename(ev.file_name)}</p>
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

            {/* 9. INTEGRITY BLOCK */}
            <div className="pt-3 border-t border-border/50 space-y-0.5">
              <p className="text-[10px] text-muted-foreground/60">
                Original entry created: {fmtFull((incident as any).original_created_at || incident.created_at)}
              </p>
              {(() => {
                const orig = (incident as any).original_created_at || incident.created_at;
                const last = (incident as any).last_modified_at || incident.updated_at;
                const changed = orig && last && new Date(last).getTime() - new Date(orig).getTime() > 1000;
                return (
                  <p className="text-[10px] text-muted-foreground/60">
                    {changed ? `Last modified: ${fmtFull(last)}` : 'No later modifications recorded'}
                  </p>
                );
              })()}
              <p className="text-[10px] text-muted-foreground/60">Original content preserved · Updates appended without overwriting</p>
              {incident.category_source === 'user' && (
                <p className="text-[10px] text-muted-foreground/60">Classification reviewed before save</p>
              )}
              {(incident as any).transcription_source_attachment_id && (
                <p className="text-[10px] text-muted-foreground/60">
                  Transcript source: audio attachment {String((incident as any).transcription_source_attachment_id).slice(0, 8)}
                </p>
              )}
            </div>

            {/* 10. CITATION BLOCK */}
            <div className="pt-2 border-t border-border/50 font-mono text-[10px] text-muted-foreground/50 space-y-0.5">
              <p>Incident ID: {incident.id}</p>
              <p>Incident date: {fmtDate(incident.incident_date)}</p>
              <p>Recorded: {fmtFull(incident.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Updates (append-only audit trail) */}
        {updates.length > 0 && (
          <div>
            <p className="section-group-title">Updates ({updates.length})</p>
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              {updates.map(entry => {
                const date = parseISO(entry.changed_at);
                return (
                  <div key={entry.id} className="text-xs text-foreground">
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

        {/* Excluded banner */}
        {incident.excluded_from_rep && (
          <div className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-[12px] font-medium">
            Excluded from rep view.
          </div>
        )}

        {/* Actions */}
        {!isVoided && (
          <div className="space-y-2.5 pt-3 pb-6">
            {/* Post-save split — incidents only */}
            {!isDaily && (
              <button
                onClick={handlePostSaveSplit}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] text-muted-foreground font-medium hover:text-foreground transition-colors border border-border rounded-xl"
              >
                <Scissors className="h-3.5 w-3.5" /> Split into separate records
              </button>
            )}

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
