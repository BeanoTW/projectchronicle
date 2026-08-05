import { V2_BASE } from '../routes';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { v2DB } from '../db';
import EvidenceSection from '../media/EvidenceSection';
import EntryView, { type SharedEntryView } from '../shared/EntryView';

const EntryScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const entry = useLiveQuery(() => (id ? v2DB.entries.get(id) : Promise.resolve(undefined)), [id]);

  if (entry === undefined) return <p className="proto-help">Loading…</p>;
  if (!entry) return (
    <div>
      <p className="proto-empty">Record not found.</p>
      <button className="proto-btn" onClick={() => navigate(V2_BASE + '/notebook')}>Back to Notebook</button>
    </div>
  );

  const details: Array<[string, string]> = [];
  if (entry.category) details.push(['Category', entry.category]);
  if (entry.context) details.push(['Context', entry.context]);
  if (entry.event_date) details.push(['Event date', `${entry.event_date}${entry.event_time ? ` · ${entry.event_time}` : ''}`]);
  if (entry.people.length > 0) details.push(['People', entry.people.join(', ')]);

  const view: SharedEntryView = {
    id: entry.id,
    title: entry.title,
    original_text: entry.original_text,
    sealed_at: entry.sealed_at,
    clarifications: entry.clarifications,
    in_dossier: entry.in_dossier,
    details,
  };

  return (
    <EntryView
      entry={view}
      standalone={false}
      onBack={() => navigate(V2_BASE + '/notebook')}
      onEditDetails={() => navigate(`${V2_BASE}/review/${entry.id}`)}
      onToggleDossier={async () => { await v2DB.entries.update(entry.id, { in_dossier: !entry.in_dossier }); }}
      onAddClarification={async (text) => {
        const next = [
          ...entry.clarifications,
          { id: crypto.randomUUID(), text, created_at: new Date().toISOString() },
        ];
        await v2DB.entries.update(entry.id, { clarifications: next });
      }}
      evidenceSlot={<EvidenceSection entryId={entry.id} />}
    />
  );
};

export default EntryScreen;
