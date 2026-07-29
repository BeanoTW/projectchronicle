import { useLiveQuery } from 'dexie-react-hooks';
import { protoDB } from '../db';

const DossierScreen = () => {
  const entries = useLiveQuery(async () => {
    const rows = await protoDB.entries.where('in_dossier').equals(1 as unknown as boolean).toArray();
    // Dexie boolean indexing is quirky — fall back to a filter for reliability.
    const all = await protoDB.entries.toArray();
    return all.filter(e => e.in_dossier).sort((a, b) => a.sealed_at.localeCompare(b.sealed_at));
  }, [], []);

  return (
    <div>
      <h1 className="proto-h1">Dossier</h1>
      <p className="proto-help" style={{ marginBottom: 16 }}>
        {entries.length} record{entries.length === 1 ? '' : 's'} included. Full configuration
        and preview arrives in Phase 2.
      </p>
      {entries.length === 0 ? (
        <div className="proto-empty">No records included yet. Open an entry and choose "Include in dossier".</div>
      ) : (
        entries.map(e => (
          <div key={e.id} className="proto-entry">
            <div className="proto-entry-meta">
              <span>{new Date(e.sealed_at).toLocaleDateString()}</span>
              {e.category && <span className="proto-chip">{e.category}</span>}
            </div>
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--p-ink-2)' }}>{e.original_text}</div>
          </div>
        ))
      )}
    </div>
  );
};

export default DossierScreen;
