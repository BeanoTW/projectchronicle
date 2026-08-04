import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { v2DB } from '../db';
import EvidenceSection from '../media/EvidenceSection';

const EntryScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const entry = useLiveQuery(() => (id ? v2DB.entries.get(id) : Promise.resolve(undefined)), [id]);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  if (entry === undefined) return <p className="proto-help">Loading…</p>;
  if (!entry) return (
    <div>
      <p className="proto-empty">Record not found.</p>
      <button className="proto-btn" onClick={() => navigate(V2_BASE + '/notebook')}>Back to Notebook</button>
    </div>
  );

  const toggleDossier = () => v2DB.entries.update(entry.id, { in_dossier: !entry.in_dossier });

  const saveClarification = async () => {
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    const next = [
      ...entry.clarifications,
      { id: crypto.randomUUID(), text: body, created_at: new Date().toISOString() },
    ];
    await v2DB.entries.update(entry.id, { clarifications: next });
    setText('');
    setAdding(false);
    setSaving(false);
  };

  const clarifications = [...entry.clarifications].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const details: Array<[string, string]> = [];
  if (entry.category) details.push(['Category', entry.category]);
  if (entry.context) details.push(['Context', entry.context]);
  if (entry.event_date) details.push(['Event date', `${entry.event_date}${entry.event_time ? ` · ${entry.event_time}` : ''}`]);
  if (entry.people.length > 0) details.push(['People', entry.people.join(', ')]);

  return (
    <div>
      <button
        className="proto-btn"
        data-variant="ghost"
        onClick={() => navigate(V2_BASE + '/notebook')}
        style={{ padding: '4px 8px', marginBottom: 8, minHeight: 32 }}
      >
        ← Notebook
      </button>

      <h1 className="proto-h1">{entry.title || 'Original record'}</h1>
      <div className="proto-entry-meta" style={{ marginBottom: 12 }}>
        <span>Sealed {new Date(entry.sealed_at).toLocaleString()}</span>
        <span className="proto-chip">Sealed</span>
        {clarifications.length > 0 && (
          <span className="proto-chip">{clarifications.length} clarification{clarifications.length === 1 ? '' : 's'}</span>
        )}
        {entry.in_dossier && <span className="proto-chip" data-tone="brass">In dossier</span>}
      </div>

      <div className="proto-sealed-note">
        <div className="proto-sealed-label">Written record — unchanged</div>
        {entry.original_text
          ? <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55 }}>{entry.original_text}</div>
          : <p className="proto-help" style={{ margin: 0 }}>No written wording. This record was captured as a voice record.</p>}
      </div>

      <section style={{ marginTop: 20 }}>
        <h2 className="proto-h2">Clarifications</h2>
        <p className="proto-help" style={{ marginBottom: 10 }}>
          A clarification adds context without changing your original record.
        </p>

        {clarifications.length === 0 && !adding && (
          <div className="proto-empty">No clarifications added.</div>
        )}

        {clarifications.map((c, i) => (
          <div key={c.id} className="proto-clar">
            <div className="proto-entry-meta">
              <span>Clarification {i + 1}</span>
              <span>{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</div>
          </div>
        ))}

        {adding ? (
          <div style={{ marginTop: 10 }}>
            <textarea
              className="proto-textarea"
              autoFocus
              placeholder="Add context, a correction of understanding, or what happened next."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className="proto-actions-row" style={{ marginTop: 8 }}>
              <button className="proto-btn" data-variant="ghost" onClick={() => { setAdding(false); setText(''); }}>
                Cancel
              </button>
              <button
                className="proto-btn"
                data-variant="primary"
                disabled={!text.trim() || saving}
                onClick={saveClarification}
              >
                Save clarification
              </button>
            </div>
          </div>
        ) : (
          <button className="proto-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => setAdding(true)}>
            Add clarification
          </button>
        )}
      </section>

      <EvidenceSection entryId={entry.id} />

      <section style={{ marginTop: 20 }}>
        <h2 className="proto-h2">Organisational details</h2>
        <div className="proto-entry">
          {details.length === 0 ? (
            <p className="proto-help" style={{ margin: 0 }}>No details added.</p>
          ) : (
            <dl className="proto-deflist">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <button
            className="proto-btn"
            style={{ marginTop: 10, width: '100%' }}
            onClick={() => navigate(`${V2_BASE}/review/${entry.id}`)}
          >
            Edit details
          </button>
        </div>
        <p className="proto-help" style={{ marginTop: 6 }}>
          Details are organisational only. Editing them never alters the sealed wording above.
        </p>
      </section>

      <div style={{ marginTop: 20 }}>
        <button
          className="proto-btn"
          data-variant={entry.in_dossier ? 'ghost' : 'primary'}
          onClick={toggleDossier}
          style={{ width: '100%' }}
        >
          {entry.in_dossier ? 'Remove from dossier' : 'Include in dossier'}
        </button>
      </div>
    </div>
  );
};

export default EntryScreen;
