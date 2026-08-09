// Phase 6 — first migrated production route.
//
// The V2 record view rendered against REAL production data:
//   - reads:  local-first Dexie incidents + follow-up notes (production layer)
//   - writes: existing production hooks only (useCreateFollowUpNote, useUpdateIncident)
// No V2 preview database is touched here.
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIncident, useUpdateIncident } from '@/hooks/useIncidents';
import { useFollowUpNotes, useCreateFollowUpNote } from '@/hooks/useFollowUpNotes';
import { useEvidence } from '@/hooks/useEvidence';
import EntryView, { type SharedEntryView } from '@/chronicle/shared/EntryView';
import RecordHistoryView from '@/chronicle/shared/RecordHistoryView';
import { toHistoryItems, wordingWasChanged } from '@/chronicle/shared/recordHistoryModel';
import { useEditHistory } from '@/hooks/useEditHistory';
import { usePrivacy } from '@/contexts/PrivacyContext';

const EvidenceList = ({ incidentId }: { incidentId: string }) => {
  const { data: files } = useEvidence(incidentId);
  const navigate = useNavigate();
  const { enabled: shielded, maskFilename, maskText } = usePrivacy();
  return (
    <section style={{ marginTop: 20 }}>
      <h2 className="proto-h2">Attachments</h2>
      {!files || files.length === 0 ? (
        <div className="proto-empty">No attachments on this record.</div>
      ) : (
        files.map(f => (
          <div key={f.id} className="proto-entry">
            <div className="proto-entry-meta">
              <span>{f.file_type ?? 'File'}</span>
              <span>{new Date(f.upload_date).toLocaleString()}</span>
              {f.evidence_ref_number != null && <span className="proto-chip">Ref {f.evidence_ref_number}</span>}
            </div>
            <div style={{ fontSize: 14 }}>{shielded ? maskFilename(f.file_name) : f.file_name}</div>
            {f.description && (
              <p className="proto-help" style={{ marginTop: 4 }}>
                {shielded ? maskText(f.description) : f.description}
              </p>
            )}
          </div>
        ))
      )}
      <button className="proto-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => navigate('/attachments')}>
        Manage attachments
      </button>
    </section>
  );
};

const EntryScreenV2 = () => {
  // V2 owns navigation on this surface; the legacy V1 bottom nav is not mounted.
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: incident, isLoading } = useIncident(id);
  const { data: notes } = useFollowUpNotes(id);
  const createNote = useCreateFollowUpNote();
  const updateIncident = useUpdateIncident();
  const { data: history, isLoading: historyLoading } = useEditHistory(id);
  const privacy = usePrivacy();
  const { enabled: shielded } = privacy;

  const view: SharedEntryView | null = useMemo(() => {
    if (!incident) return null;
    // Privacy Shield is a display filter only — stored data and exports are untouched.
    const text = (v: string | null | undefined) => (shielded ? privacy.maskText(v) : (v ?? ''));
    const entity = (v: string | null | undefined) =>
      shielded ? privacy.maskEntities(v, incident) : (v ?? '');

    const isDaily = incident.record_type === 'daily_record';
    const eventDate = (isDaily ? incident.record_date : null) ?? incident.incident_date;

    const details: Array<[string, string]> = [];
    // Record type is never masked — it carries no identifying content.
    details.push(['Record type', isDaily ? 'Daily record' : 'Incident']);
    if (incident.category) details.push(['Category', incident.category]);
    if (incident.subtype) details.push(['Subtype', incident.subtype]);
    if (incident.context_domain) details.push(['Context', incident.context_domain]);
    details.push(['Event date', `${eventDate}${incident.incident_time ? ` · ${incident.incident_time}` : ''}`]);
    if (incident.location) details.push(['Location', text(incident.location)]);
    if (incident.people_involved.length > 0)
      details.push(['People', (shielded ? privacy.maskNames(incident.people_involved) : incident.people_involved).join(', ')]);
    if (incident.status) details.push(['Status', incident.status]);
    return {
      id: incident.id,
      title: incident.title ? entity(incident.title) : incident.title,
      original_text: text(incident.raw_narrative),
      sealed_at: incident.original_created_at ?? incident.created_at,
      clarifications: (notes ?? []).map(n => ({
        id: n.id,
        text: shielded ? privacy.maskText(n.note_text) : n.note_text,
        created_at: n.created_at,
      })),
      in_dossier: !incident.excluded_from_rep,
      details,
    };
  }, [incident, notes, shielded, privacy]);

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (!incident || !view) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground mb-3">Record not found.</p>
        <button className="underline" onClick={() => navigate('/timeline')}>Back to timeline</button>
      </div>
    );
  }

  return (
    <EntryView
      entry={view}
      backLabel="← Timeline"
      onBack={() => navigate('/timeline')}
      onAddClarification={async (text) => {
        await createNote.mutateAsync({ incident_id: incident.id, note_text: text, note_type: 'Update' });
      }}
      onToggleDossier={async () => {
        await updateIncident.mutateAsync({ id: incident.id, excluded_from_rep: !incident.excluded_from_rep });
      }}
      evidenceSlot={<EvidenceList incidentId={incident.id} />}
      notice={shielded ? 'Privacy Shield is on — names and wording are hidden on screen only. Your stored record and exports are unchanged.' : undefined}
      footerSlot={
        <RecordHistoryView
          sealedAt={incident.original_created_at ?? incident.created_at}
          items={toHistoryItems(history ?? [])}
          originalWordingChanged={wordingWasChanged(history ?? [])}
          loading={historyLoading}
        />
      }
    />
  );
};

export default EntryScreenV2;
