// Shared V2 record view (Phase 6).
//
// Source-agnostic presentation used by BOTH:
//   - the V2 candidate app (Dexie preview data)
//   - the migrated production route /incident/:id (real production data)
//
// It owns no data access. All reads/writes arrive through props so production
// writes stay behind the existing production interfaces.
import SettingsControl from '@/components/chronicle/SettingsControl';
import { useState, type ReactNode } from 'react';
import '../styles.css';

export interface SharedClarification {
  id: string;
  text: string;
  created_at: string;
}

export interface SharedEntryView {
  id: string;
  title: string | null;
  /** Immutable original wording. */
  original_text: string;
  /** ISO — the moment the record became a fixed record. */
  sealed_at: string;
  clarifications: SharedClarification[];
  in_dossier: boolean;
  details: Array<[string, string]>;
}

export interface EntryViewProps {
  entry: SharedEntryView;
  onBack: () => void;
  onAddClarification: (text: string) => Promise<void>;
  onToggleDossier: () => void | Promise<void>;
  /** Omitted when the surface has no details editor. */
  onEditDetails?: () => void;
  /** Evidence UI differs per data source; injected by the caller. */
  evidenceSlot?: ReactNode;
  backLabel?: string;
  /** Quiet status line under the title (e.g. Privacy Shield active). */
  notice?: ReactNode;
  /** Extra section rendered after organisational details (e.g. record history). */
  footerSlot?: ReactNode;
  /** False when already rendered inside a `.proto-root .proto-main` shell. */
  standalone?: boolean;
}

const EntryView = ({
  entry,
  onBack,
  onAddClarification,
  onToggleDossier,
  onEditDetails,
  evidenceSlot,
  notice,
  footerSlot,
  backLabel = '← Notebook',
  standalone = true,

}: EntryViewProps) => {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const clarifications = [...entry.clarifications].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const save = async () => {
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    try {
      await onAddClarification(body);
      setText('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <>
      <div>

        <button
          className="proto-btn"
          data-variant="ghost"
          onClick={onBack}
          style={{ padding: '4px 8px', marginBottom: 8, minHeight: 32 }}
        >
          {backLabel}
        </button>

        <h1 className="proto-h1">{entry.title || 'Original record'}</h1>
        <div className="proto-entry-meta" style={{ marginBottom: 12 }}>
          <span>Sealed {new Date(entry.sealed_at).toLocaleString()}</span>
          <span className="proto-chip">Sealed</span>
          {clarifications.length > 0 && (
            <span className="proto-chip">
              {clarifications.length} clarification{clarifications.length === 1 ? '' : 's'}
            </span>
          )}
          {entry.in_dossier && <span className="proto-chip" data-tone="brass">In My Record</span>}
        </div>

        {notice && <p className="proto-help" role="status" style={{ marginBottom: 10 }}>{notice}</p>}

        {/* Desktop: a comfortable reading column with a secondary rail.
            Mobile: the same order in one column. */}
        <div className="proto-entrylayout">
        <div>
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
                  onClick={save}
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
        </div>

        <div>
        {evidenceSlot}

        <section style={{ marginTop: 20 }}>
          <h2 className="proto-h2">Organisational details</h2>
          <div className="proto-entry">
            {entry.details.length === 0 ? (
              <p className="proto-help" style={{ margin: 0 }}>No details added.</p>
            ) : (
              <dl className="proto-deflist">
                {entry.details.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {onEditDetails && (
              <button className="proto-btn" style={{ marginTop: 10, width: '100%' }} onClick={onEditDetails}>
                Edit details
              </button>
            )}
          </div>
          <p className="proto-help" style={{ marginTop: 6 }}>
            Details are organisational only. Editing them never alters the sealed wording above.
          </p>
        </section>

        {footerSlot}



        <div style={{ marginTop: 20 }}>
          <button
            className="proto-btn"
            data-variant={entry.in_dossier ? 'ghost' : 'primary'}
            onClick={() => { void onToggleDossier(); }}
            style={{ width: '100%' }}
          >
            {entry.in_dossier ? 'Remove from My Record' : 'Add to My Record'}
          </button>
        </div>
        </div>
        </div>
      </div>
    </>
  );

  if (!standalone) return body;
  return (
    <div className="proto-root">
      <div className="proto-main">
        {/* Phase 9 — secondary shell control, same as every other V2 surface. */}
        <SettingsControl />
        {body}
      </div>
    </div>
  );
};


export default EntryView;
