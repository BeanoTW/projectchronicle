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
import EntryView, { type SharedEntryView } from '@/v2/shared/EntryView';

const EvidenceList = ({ incidentId }: { incidentId: string }) => {
  const { data: files } = useEvidence(incidentId);
  const navigate = useNavigate();
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
            <div style={{ fontSize: 14 }}>{f.file_name}</div>
            {f.description && <p className="proto-help" style={{ marginTop: 4 }}>{f.description}</p>}
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
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: incident, isLoading } = useIncident(id);
  const { data: notes } = useFollowUpNotes(id);
  const createNote = useCreateFollowUpNote();
  const updateIncident = useUpdateIncident();

  const view: SharedEntryView | null = useMemo(() => {
    if (!incident) return null;
    const details: Array<[string, string]> = [];
    if (incident.category) details.push(['Category', incident.category]);
    if (incident.subtype) details.push(['Subtype', incident.subtype]);
    if (incident.context_domain) details.push(['Context', incident.context_domain]);
    details.push(['Event date', `${incident.incident_date}${incident.incident_time ? ` · ${incident.incident_time}` : ''}`]);
    if (incident.location) details.push(['Location', incident.location]);
    if (incident.people_involved.length > 0) details.push(['People', incident.people_involved.join(', ')]);
    if (incident.status) details.push(['Status', incident.status]);
    return {
      id: incident.id,
      title: incident.title,
      original_text: incident.raw_narrative,
      sealed_at: incident.original_created_at ?? incident.created_at,
      clarifications: (notes ?? []).map(n => ({ id: n.id, text: n.note_text, created_at: n.created_at })),
      in_dossier: !incident.excluded_from_rep,
      details,
    };
  }, [incident, notes]);

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
    />
  );
};

export default EntryScreenV2;
