import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { protoDB } from '../db';

const EntryScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const entry = useLiveQuery(() => (id ? protoDB.entries.get(id) : Promise.resolve(undefined)), [id]);

  if (entry === undefined) return <p className="proto-help">Loading…</p>;
  if (!entry) return (
    <div>
      <p className="proto-empty">Record not found.</p>
      <button className="proto-btn" onClick={() => navigate('/prototype/notebook')}>Back to Notebook</button>
    </div>
  );

  const toggleDossier = () => protoDB.entries.update(entry.id, { in_dossier: !entry.in_dossier });

  return (
    <div>
      <button
        className="proto-btn"
        data-variant="ghost"
        onClick={() => navigate('/prototype/notebook')}
        style={{ padding: '4px 8px', marginBottom: 8, minHeight: 32 }}
      >
        ← Notebook
      </button>

      <h1 className="proto-h1">{entry.title || 'Original record'}</h1>
      <div className="proto-entry-meta" style={{ marginBottom: 12 }}>
        <span>Sealed {new Date(entry.sealed_at).toLocaleString()}</span>
        <span className="proto-chip">Sealed</span>
        {entry.in_dossier && <span className="proto-chip" data-tone="brass">In dossier</span>}
      </div>

      <div className="proto-sealed-note">
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-muted)', marginBottom: 6 }}>
          Original record — unchanged
        </div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55 }}>{entry.original_text}</div>
      </div>

      {entry.clarifications.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2 className="proto-h2">Added clarifications</h2>
          {entry.clarifications.map(c => (
            <div key={c.id} className="proto-entry">
              <div className="proto-entry-meta">{new Date(c.created_at).toLocaleString()}</div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <h2 className="proto-h2">Organisational details</h2>
        <div className="proto-entry">
          <div className="proto-entry-meta">
            {entry.category && <span className="proto-chip">{entry.category}</span>}
            {entry.context && <span className="proto-chip">{entry.context}</span>}
            {entry.event_date && <span className="proto-chip">Event: {entry.event_date}{entry.event_time ? ` ${entry.event_time}` : ''}</span>}
            {entry.people.map(p => <span key={p} className="proto-chip">{p}</span>)}
            {!entry.category && !entry.context && !entry.event_date && entry.people.length === 0 && (
              <span style={{ color: 'var(--p-muted)', fontSize: 12 }}>No details added.</span>
            )}
          </div>
          <button
            className="proto-btn"
            style={{ marginTop: 8 }}
            onClick={() => navigate(`/prototype/review/${entry.id}`)}
          >
            Edit details
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="proto-btn" data-variant={entry.in_dossier ? 'ghost' : 'primary'} onClick={toggleDossier} style={{ width: '100%' }}>
          {entry.in_dossier ? 'Remove from dossier' : 'Include in dossier'}
        </button>
      </div>
    </div>
  );
};

export default EntryScreen;
