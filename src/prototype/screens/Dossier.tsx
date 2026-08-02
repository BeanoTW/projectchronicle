import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { protoDB, type PrototypeEntry } from '../db';
import { entryDate } from '../filters';

/* Preview-format preferences only. Membership lives on `in_dossier` in the DB. */
interface DossierPrefs {
  title: string;
  includeClarifications: boolean;
  includeDetails: boolean; // organisational details: event date, category, context, people
  order: 'asc' | 'desc';
}

const DEFAULT_TITLE = 'Dossier';

const defaultPrefs: DossierPrefs = {
  title: DEFAULT_TITLE,
  includeClarifications: true,
  includeDetails: true,
  order: 'asc',
};

/* Configure-list filters. They change what is listed for selection only —
   they never add or remove records from the dossier. */
interface ListFilters {
  category: string | null;
  person: string | null;
  from: string | null;
  to: string | null;
}

const emptyListFilters: ListFilters = { category: null, person: null, from: null, to: null };

const fmtLong = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const DossierScreen = () => {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<DossierPrefs>(defaultPrefs);
  const [lf, setLf] = useState<ListFilters>(emptyListFilters);
  const [tab, setTab] = useState<'configure' | 'preview'>('configure');

  const all = useLiveQuery(async () => protoDB.entries.toArray(), [], []) as PrototypeEntry[];

  const categories = useMemo(
    () => Array.from(new Set(all.map(e => e.category).filter(Boolean) as string[])).sort(),
    [all],
  );
  const people = useMemo(
    () => Array.from(new Set(all.flatMap(e => e.people))).sort(),
    [all],
  );

  /* Filtered view of ALL records, for selection in Configure. */
  const listed = useMemo(() => {
    return all
      .filter(e => {
        if (lf.category && e.category !== lf.category) return false;
        if (lf.person && !e.people.includes(lf.person)) return false;
        const d = entryDate(e);
        if (lf.from && d < lf.from) return false;
        if (lf.to && d > lf.to) return false;
        return true;
      })
      .sort((a, b) => b.sealed_at.localeCompare(a.sealed_at));
  }, [all, lf]);

  /* The dossier itself: every record with in_dossier = true. Filters do not apply. */
  const included = useMemo(
    () =>
      all
        .filter(e => e.in_dossier)
        .sort((a, b) =>
          prefs.order === 'asc'
            ? a.sealed_at.localeCompare(b.sealed_at)
            : b.sealed_at.localeCompare(a.sealed_at),
        ),
    [all, prefs.order],
  );

  const filtersActive =
    !!lf.category || !!lf.person || !!lf.from || !!lf.to;
  const hiddenIncluded = included.length - listed.filter(e => e.in_dossier).length;

  const toggle = (id: string, on: boolean) => protoDB.entries.update(id, { in_dossier: on });

  return (
    <div>
      <h1 className="proto-h1">Dossier</h1>
      <p className="proto-help" style={{ marginBottom: 12 }}>
        A dossier is a selection of your sealed records, presented in chronological order. Original
        wording is never altered. Export is not available in this prototype.
      </p>

      <div className="proto-viewswitch" style={{ width: '100%', marginBottom: 14 }} role="group" aria-label="Dossier view">
        <button style={{ flex: 1 }} data-active={tab === 'configure'} onClick={() => setTab('configure')}>Configure</button>
        <button style={{ flex: 1 }} data-active={tab === 'preview'} onClick={() => setTab('preview')}>Preview</button>
      </div>

      {tab === 'configure' ? (
        <>
          <section className="proto-fgroup">
            <h2 className="proto-flabel">Title</h2>
            <input
              className="proto-input"
              value={prefs.title}
              placeholder={DEFAULT_TITLE}
              onChange={e => setPrefs({ ...prefs, title: e.target.value })}
            />
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Order</h2>
            <div className="proto-chipwrap">
              <button className="proto-selchip" data-on={prefs.order === 'asc'} onClick={() => setPrefs({ ...prefs, order: 'asc' })}>
                Oldest first
              </button>
              <button className="proto-selchip" data-on={prefs.order === 'desc'} onClick={() => setPrefs({ ...prefs, order: 'desc' })}>
                Newest first
              </button>
            </div>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Preview format</h2>
            <div className="proto-chipwrap">
              <button className="proto-selchip" data-on={prefs.includeClarifications}
                onClick={() => setPrefs({ ...prefs, includeClarifications: !prefs.includeClarifications })}>
                Clarifications
              </button>
              <button className="proto-selchip" data-on={prefs.includeDetails}
                onClick={() => setPrefs({ ...prefs, includeDetails: !prefs.includeDetails })}>
                Organisational details
              </button>
            </div>
            <p className="proto-help">
              Organisational details cover the event date, category, context and people recorded.
              These settings change how the dossier is displayed, not which records it contains.
            </p>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Filter the list</h2>
            <div className="proto-daterow">
              <label>
                <span className="proto-help">From</span>
                <input className="proto-input" type="date" value={lf.from ?? ''}
                  onChange={e => setLf({ ...lf, from: e.target.value || null })} />
              </label>
              <label>
                <span className="proto-help">To</span>
                <input className="proto-input" type="date" value={lf.to ?? ''}
                  onChange={e => setLf({ ...lf, to: e.target.value || null })} />
              </label>
            </div>

            {categories.length > 0 && (
              <div className="proto-chipwrap" style={{ marginTop: 10 }}>
                {categories.map(c => (
                  <button key={c} className="proto-selchip" data-on={lf.category === c}
                    onClick={() => setLf({ ...lf, category: lf.category === c ? null : c })}>
                    {c}
                  </button>
                ))}
              </div>
            )}

            {people.length > 0 && (
              <div className="proto-chipwrap" style={{ marginTop: 8 }}>
                {people.map(p => (
                  <button key={p} className="proto-selchip" data-on={lf.person === p}
                    onClick={() => setLf({ ...lf, person: lf.person === p ? null : p })}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {filtersActive && (
              <button className="proto-btn" data-variant="ghost" style={{ marginTop: 10 }}
                onClick={() => setLf(emptyListFilters)}>
                Clear filters
              </button>
            )}
            <p className="proto-help">
              Filters change which records are listed here. They never add or remove records from
              the dossier.
            </p>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Records</h2>
            {all.length === 0 ? (
              <div className="proto-empty">No records yet.</div>
            ) : listed.length === 0 ? (
              <div className="proto-empty">No records match these filters.</div>
            ) : (
              listed.map(e => (
                <label key={e.id} className="proto-selectrow">
                  <input
                    type="checkbox"
                    checked={e.in_dossier}
                    onChange={ev => toggle(e.id, ev.target.checked)}
                  />
                  <span>
                    <span className="proto-selectrow-title">
                      {e.title || e.original_text.slice(0, 48) + (e.original_text.length > 48 ? '…' : '')}
                    </span>
                    <span className="proto-help">
                      {new Date(e.sealed_at).toLocaleDateString()}
                      {e.category ? ` · ${e.category}` : ''}
                    </span>
                  </span>
                </label>
              ))
            )}
          </section>

          <p className="proto-help">
            {included.length} record{included.length === 1 ? '' : 's'} in the dossier
            {filtersActive && hiddenIncluded > 0
              ? ` · ${hiddenIncluded} of them hidden by the current filters`
              : ''}.
          </p>
        </>
      ) : (
        <div className="proto-preview">
          <div className="proto-preview-head">
            <h2 className="proto-serif" style={{ fontSize: 22, margin: 0 }}>
              {prefs.title.trim() || DEFAULT_TITLE}
            </h2>
            <p className="proto-help" style={{ margin: '4px 0 0' }}>
              {included.length} record{included.length === 1 ? '' : 's'} ·{' '}
              {prefs.order === 'asc' ? 'oldest first' : 'newest first'}
            </p>
          </div>

          {included.length === 0 ? (
            <div className="proto-empty">
              No records included yet. Select records in Configure, or open an entry and choose
              “Include in dossier”.
            </div>
          ) : (
            included.map((e, i) => (
              <article key={e.id} className="proto-preview-item">
                <div className="proto-preview-num">Record {i + 1}</div>
                <div className="proto-entry-meta">
                  <span>Sealed {fmtLong(e.sealed_at)}</span>
                  {prefs.includeDetails && e.event_date && <span className="proto-chip">Event {e.event_date}</span>}
                  {prefs.includeDetails && e.category && <span className="proto-chip">{e.category}</span>}
                  {prefs.includeDetails && e.context && <span className="proto-chip">{e.context}</span>}
                  {prefs.includeDetails && e.people.map(p => <span key={p} className="proto-chip">{p}</span>)}
                </div>
                {e.title && <div className="proto-serif" style={{ fontSize: 17, margin: '6px 0 4px' }}>{e.title}</div>}
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55 }}>{e.original_text}</div>
                {prefs.includeClarifications && e.clarifications.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {[...e.clarifications]
                      .sort((a, b) => a.created_at.localeCompare(b.created_at))
                      .map((c, ci) => (
                        <div key={c.id} className="proto-clar">
                          <div className="proto-entry-meta">
                            <span>Clarification {ci + 1} · {fmtLong(c.created_at)}</span>
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</div>
                        </div>
                      ))}
                  </div>
                )}
                <button
                  className="proto-btn"
                  data-variant="ghost"
                  style={{ marginTop: 10, minHeight: 32, padding: '4px 10px' }}
                  onClick={() => navigate(`/prototype/entry/${e.id}`)}
                >
                  Open record
                </button>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DossierScreen;
