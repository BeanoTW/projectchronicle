import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { protoDB } from '../db';

type View = 'list' | 'compact';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
});
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, {
  hour: '2-digit', minute: '2-digit',
});

const NotebookScreen = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('list');

  const entries = useLiveQuery(async () => {
    const rows = await protoDB.entries.toArray();
    return rows.sort((a, b) => b.sealed_at.localeCompare(a.sealed_at));
  }, [], []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(e =>
      e.original_text.toLowerCase().includes(term) ||
      (e.title ?? '').toLowerCase().includes(term) ||
      (e.category ?? '').toLowerCase().includes(term) ||
      e.people.some(p => p.toLowerCase().includes(term))
    );
  }, [entries, q]);

  return (
    <div>
      <h1 className="proto-h1">Notebook</h1>

      <div className="proto-controls">
        <input
          className="proto-input"
          placeholder="Search records"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="proto-viewswitch" role="group" aria-label="View">
          <button data-active={view === 'list'} onClick={() => setView('list')}>List</button>
          <button data-active={view === 'compact'} onClick={() => setView('compact')}>Compact</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button
          className="proto-btn"
          onClick={() => alert('Filters panel arrives in Phase 2.')}
          style={{ width: '100%' }}
        >
          Filters
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="proto-empty">
          {q ? 'No records match that search.' : 'No records yet. Tap Capture to start.'}
        </div>
      ) : (
        filtered.map(e => {
          const preview = e.original_text.length > 140 && view === 'compact'
            ? e.original_text.slice(0, 140) + '…'
            : e.original_text;
          const hasClar = e.clarifications.length > 0;
          return (
            <button
              key={e.id}
              onClick={() => navigate(`/prototype/entry/${e.id}`)}
              className="proto-entry"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="proto-entry-meta">
                <span>{fmtDate(e.sealed_at)} · {fmtTime(e.sealed_at)}</span>
                <span className="proto-chip">Sealed</span>
                {hasClar && <span className="proto-chip">Clarification added</span>}
                {e.in_dossier && <span className="proto-chip" data-tone="brass">In dossier</span>}
                {e.category && <span className="proto-chip">{e.category}</span>}
              </div>
              {e.title && (
                <div className="proto-serif" style={{ fontSize: 17, marginBottom: 4 }}>{e.title}</div>
              )}
              <div style={{
                fontSize: 14, lineHeight: 1.5, color: 'var(--p-ink-2)',
                display: '-webkit-box',
                WebkitLineClamp: view === 'compact' ? 2 : 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {preview}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

export default NotebookScreen;
