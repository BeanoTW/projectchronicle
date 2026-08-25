import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIncident, useUpdateIncident } from '@/hooks/useIncidents';
import { useFollowUpNotes, useCreateFollowUpNote } from '@/hooks/useFollowUpNotes';
import { useEvidence } from '@/hooks/useEvidence';
import { useEditHistory } from '@/hooks/useEditHistory';
import EntryView, { type SharedEntryView } from '@/chronicle/shared/EntryView';
import RecordHistoryView from '@/chronicle/shared/RecordHistoryView';
import { CanonicalDetailsEditor } from '@/chronicle/shared/CanonicalDetailsEditor';
import { CanonicalPeopleEditor } from '@/chronicle/shared/CanonicalPeopleEditor';
import { CanonicalOrganisationEditor } from '@/chronicle/shared/CanonicalOrganisationEditor';
import { toHistoryItems, wordingWasChanged } from '@/chronicle/shared/recordHistoryModel';
import { canonicalEntryToSharedView, canonicalHistoryToItems } from '@/chronicle/shared/canonicalEntryAdapter';
import { CanonicalEvidenceList } from '@/chronicle/shared/CanonicalEvidenceList';
import { readCanonicalEntryBundle, type CanonicalEntryBundle } from '@/chronicle/model/canonicalEntryReader';
import { canonicalEntryWriter } from '@/chronicle/model/canonicalEntryWriter';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useAuth } from '@/contexts/AuthContext';
import { attachmentDisplayName, hasCustomAttachmentName } from '@/lib/attachmentName';

const LegacyEvidenceList = ({ incidentId }: { incidentId: string }) => {
  const { data: files } = useEvidence(incidentId);
  const navigate = useNavigate();
  const { enabled: shielded, maskFilename, maskText } = usePrivacy();
  return <section style={{ marginTop: 20 }}><h2 className="proto-h2">Attachments</h2>
    {!files || files.length === 0 ? <div className="proto-empty">No attachments on this record.</div> : files.map(f => <div key={f.id} className="proto-entry"><div className="proto-entry-meta"><span>{f.file_type ?? 'File'}</span><span>{new Date(f.upload_date).toLocaleString()}</span>{f.evidence_ref_number != null && <span className="proto-chip">Ref {f.evidence_ref_number}</span>}</div><div style={{ fontSize: 14 }}>{shielded ? maskFilename(attachmentDisplayName(f)) : attachmentDisplayName(f)}</div>{hasCustomAttachmentName(f) && <div className="proto-help" style={{ marginTop: 3, fontSize: 12 }}>Original: {shielded ? maskFilename(f.file_name) : f.file_name}</div>}{f.description && <p className="proto-help" style={{ marginTop: 4 }}>{shielded ? maskText(f.description) : f.description}</p>}</div>)}
    <button className="proto-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => navigate('/attachments')}>Manage attachments</button></section>;
};

const EntryScreenV2 = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const privacy = usePrivacy();
  const { enabled: shielded } = privacy;
  const { data: legacyIncident, isLoading: legacyLoading } = useIncident(id);
  const { data: legacyNotes } = useFollowUpNotes(id);
  const createNote = useCreateFollowUpNote();
  const updateIncident = useUpdateIncident();
  const { data: legacyHistory, isLoading: historyLoading } = useEditHistory(id);
  const [bundle, setBundle] = useState<CanonicalEntryBundle | null | undefined>(undefined);
  const [editingDetails, setEditingDetails] = useState(false);

  const refreshCanonical = useCallback(async () => {
    if (!user?.id || !id) { setBundle(null); return; }
    setBundle(await readCanonicalEntryBundle(user.id, id));
  }, [user?.id, id]);

  useEffect(() => {
    let cancelled = false;
    setEditingDetails(false);
    if (!user?.id || !id) { setBundle(null); return () => { cancelled = true; }; }
    setBundle(undefined);
    void readCanonicalEntryBundle(user.id, id).then(value => { if (!cancelled) setBundle(value); }).catch(() => { if (!cancelled) setBundle(null); });
    return () => { cancelled = true; };
  }, [user?.id, id]);

  const canonicalActive = bundle?.source === 'canonical';
  const rawView: SharedEntryView | null = useMemo(() => {
    if (canonicalActive && bundle) return canonicalEntryToSharedView(bundle);
    if (!legacyIncident) return null;
    const isDaily = legacyIncident.record_type === 'daily_record';
    const eventDate = (isDaily ? legacyIncident.record_date : null) ?? legacyIncident.incident_date;
    const details: Array<[string, string]> = [['Record type', isDaily ? 'Daily record' : 'Incident']];
    if (legacyIncident.category) details.push(['Category', legacyIncident.category]);
    if (legacyIncident.subtype) details.push(['Subtype', legacyIncident.subtype]);
    if (legacyIncident.context_domain) details.push(['Context', legacyIncident.context_domain]);
    if (eventDate) details.push(['Event date', `${eventDate}${legacyIncident.incident_time ? ` · ${legacyIncident.incident_time}` : ''}`]);
    if (legacyIncident.location) details.push(['Location', legacyIncident.location]);
    if (legacyIncident.people_involved.length) details.push(['People', legacyIncident.people_involved.join(', ')]);
    if (legacyIncident.status) details.push(['Status', legacyIncident.status]);
    return { id: legacyIncident.id, title: legacyIncident.title, original_text: legacyIncident.raw_narrative ?? '', sealed_at: legacyIncident.original_created_at ?? legacyIncident.created_at, clarifications: (legacyNotes ?? []).map(n => ({ id: n.id, text: n.note_text, created_at: n.created_at })), in_dossier: !legacyIncident.excluded_from_rep, details };
  }, [canonicalActive, bundle, legacyIncident, legacyNotes]);

  const view = useMemo(() => {
    if (!rawView) return null;
    if (!shielded) return rawView;
    const peopleRow = rawView.details.find(([key]) => key === 'People');
    const people = peopleRow?.[1].split(', ').filter(Boolean) ?? [];
    return { ...rawView, title: rawView.title ? privacy.maskEntities(rawView.title, { people_involved: people }) : rawView.title, original_text: privacy.maskText(rawView.original_text), clarifications: rawView.clarifications.map(c => ({ ...c, text: privacy.maskText(c.text) })), details: rawView.details.map(([key, value]) => key === 'People' ? [key, privacy.maskNames(people).join(', ')] as [string, string] : key === 'Location' ? [key, privacy.maskText(value)] as [string, string] : [key, value] as [string, string]) };
  }, [rawView, shielded, privacy]);

  const loading = bundle === undefined || (!canonicalActive && legacyLoading);
  if (loading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (!view) return <div className="p-6"><p className="text-muted-foreground mb-3">Record not found.</p><button className="underline" onClick={() => navigate('/timeline')}>Back to timeline</button></div>;

  return <EntryView entry={view} backLabel="← Timeline" onBack={() => navigate('/timeline')}
    onAddClarification={async (text, kind) => {
      if (canonicalActive && bundle && user?.id) { await canonicalEntryWriter.addClarification(user.id, bundle.record.id, text, kind); await refreshCanonical(); return; }
      if (!legacyIncident) throw new Error('Record not found.');
      await createNote.mutateAsync({ incident_id: legacyIncident.id, note_text: text, note_type: 'Update' });
    }}
    onToggleDossier={async () => {
      if (canonicalActive && bundle && user?.id) { await canonicalEntryWriter.setChronicleMembership(user.id, bundle.record.id, !view.in_dossier); await refreshCanonical(); return; }
      if (legacyIncident) await updateIncident.mutateAsync({ id: legacyIncident.id, excluded_from_rep: !legacyIncident.excluded_from_rep });
    }}
    onEditDetails={canonicalActive ? () => setEditingDetails(true) : undefined}
    allowMutations
    allowClarificationKinds={canonicalActive}
    evidenceSlot={canonicalActive && bundle && user?.id
      ? <CanonicalEvidenceList ownerId={user.id} recordId={bundle.record.id} files={bundle.media} onChanged={refreshCanonical} />
      : legacyIncident ? <LegacyEvidenceList incidentId={legacyIncident.id} /> : undefined}
    notice={canonicalActive ? 'This record is using Chronicle’s audited canonical store.' : shielded ? 'Privacy Shield is on — names and wording are hidden on screen only. Your stored record and exports are unchanged.' : undefined}
    footerSlot={<>
      {canonicalActive && bundle && user?.id && <CanonicalPeopleEditor ownerId={user.id} recordId={bundle.record.id} people={bundle.people} relationships={bundle.relationships} onChanged={refreshCanonical} />}
      {canonicalActive && bundle && user?.id && <CanonicalOrganisationEditor ownerId={user.id} recordId={bundle.record.id} organisations={bundle.organisations} relationships={bundle.relationships} onChanged={refreshCanonical} />}
      {canonicalActive && bundle && editingDetails && <CanonicalDetailsEditor details={bundle.record.details} onCancel={() => setEditingDetails(false)} onSave={async patch => { if (!user?.id) return; await canonicalEntryWriter.updateDetails(user.id, bundle.record, patch); await refreshCanonical(); setEditingDetails(false); }} />}
      <RecordHistoryView sealedAt={view.sealed_at} items={canonicalActive && bundle ? canonicalHistoryToItems(bundle) : toHistoryItems(legacyHistory ?? [])} originalWordingChanged={canonicalActive ? false : wordingWasChanged(legacyHistory ?? [])} loading={canonicalActive ? false : historyLoading} />
    </>}
  />;
};
export default EntryScreenV2;
