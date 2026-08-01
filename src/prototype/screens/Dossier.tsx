import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { protoDB, type PrototypeEntry } from '../db';
import { entryDate } from '../filters';

interface DossierConfig {
  title: string;
  from: string | null;
  to: string | null;
  includeClarifications: boolean;
  includeDetails: boolean;
  includePeople: boolean;
  order: 'asc' | 'desc';
}

const defaultConfig: DossierConfig = {
  title: 'Workplace record',
  from: null,
  to: null,
  includeClarifications: true,
  includeDetails: true,
  includePeople: true,
  order: 'asc',
};

const fmtLong = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const DossierScreen = () => {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<DossierConfig>(defaultConfig);
  const [tab, setTab] = useState<'configure' | 'preview'>('configure');

  const all = useLiveQuery(async () => protoDB.entries.toArray(), [], []) as PrototypeEntry[];

  const included = useMemo(() => {
    const rows = all.filter(e => e.in_dossier);
    const ranged = rows.filter(e => {
      const d = entryDate(e);
      if (cfg.from && d < cfg.from) return false;
      if (cfg.to && d > cfg.to) return false;
      return true;
    });
    return ranged.sort((a, b) =>
      cfg.order === 'asc' ? a.sealed_at.localeCompare(b.sealed_at) : b.sealed_at.localeCompare(a.sealed_at),
    );
  }, [all, cfg]);

  const excludedByRange = all.filter(e => e.in_dossier).length - included.length;

  const toggle = (id: string, on: boolean) => protoDB.entries.update(id, { in_dossier: on });

  return (
    <div>
      <h1 className="proto-h1">Dossier</h1>
      <p className="proto-help" style={{ marginBottom: 12 }}>
        A dossier is a selection of your sealed records, presented in order. Original wording is
        never altered. Export is not available in this prototype.
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
              value={cfg.title}
              onChange={e => setCfg({ ...cfg, title: e.target.value })}
            />
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Date range</h2>
            <div className="proto-daterow">
              <label>
                <span className="proto-help">From</span>
                <input className="proto-input" type="date" value={cfg.from ?? ''}
                  onChange={e => setCfg({ ...cfg, from: e.target.value || null })} />
              </label>
              <label>
                <span className="proto-help">To</span>
                <input className="proto-input" type="date" value={cfg.to ?? ''}
                  onChange={e => setCfg({ ...cfg, to: e.target.value || null })} />
              </label>
            </div>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">What to include</h2>
            <div className="proto-chipwrap">
              <button className="proto-selchip" data-on={cfg.includeClarifications}
                onClick={() => setCfg({ ...cfg, includeClarifications: !cfg.includeClarifications })}>
                Clarifications
              </button>
              <button className="proto-selchip" data-on={cfg.includeDetails}
                onClick={() => setCfg({ ...cfg, includeDetails: !cfg.includeDetails })}>
                Organisational details
              </button>
              <button className="proto-selchip" data-on={cfg.includePeople}
                onClick={() => setCfg({ ...cfg, includePeople: !cfg.includePeople })}>
                People
              </button>
            </div>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Order</h2>
            <div className="proto-chipwrap">
              <button className="proto-selchip" data-on={cfg.order === 'asc'} onClick={() => setCfg({ ...cfg, order: 'asc' })}>
                Oldest first
              </button>
              <button className="proto-selchip" data-on={cfg.order === 'desc'} onClick={() => setCfg({ ...cfg, order: 'desc' })}>
                Newest first
              </button>
            </div>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Records</h2>
            {all.length === 0 ? (
              <div className="proto-empty">No records yet.</div>
            ) : (
              [...all]
                .sort((a, b) => b.sealed_at.localeCompare(a.sealed_at))
                .map(e => (
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
            {excludedByRange > 0 ? ` · ${excludedByRange} excluded by date range` : ''}.
          </p>
        </>
      ) : (
        <div className="proto-preview">
          <div className="proto-preview-head">
            <h2 className="proto-serif" style={{ fontSize: 22, margin: 0 }}>{cfg.title || 'Untitled dossier'}</h2>
            <p className="proto-help" style={{ margin: '4px 0 0' }}>
              {included.length} record{included.length === 1 ? '' : 's'} ·{' '}
              {cfg.order === 'asc' ? 'oldest first' : 'newest first'}
              {cfg.from || cfg.to ? ` · ${cfg.from ?? 'start'} to ${cfg.to ?? 'today'}` : ''}
            </p>
          </div>

          {included.length === 0 ? (
            <div className="proto-empty">
              {all.some(e => e.in_dossier)
                ? 'Every included record falls outside the selected date range.'
                : 'No records included yet. Select records in Configure, or open an entry and choose “Include in dossier”.'}
            </div>
          ) : (
            included.map((e, i) => (
              <article key={e.id} className="proto-preview-item">
                <div className="proto-preview-num">Record {i + 1}</div>
                <div className="proto-entry-meta">
                  <span>Sealed {fmtLong(e.sealed_at)}</span>
                  {cfg.includeDetails && e.event_date && <span className="proto-chip">Event {e.event_date}</span>}
                  {cfg.includeDetails && e.category && <span className="proto-chip">{e.category}</span>}
                  {cfg.includeDetails && e.context && <span className="proto-chip">{e.context}</span>}
                  {cfg.includePeople && e.people.map(p => <span key={p} className="proto-chip">{p}</span>)}
                </div>
                {e.title && <div className="proto-serif" style={{ fontSize: 17, margin: '6px 0 4px' }}>{e.title}</div>}
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55 }}>{e.original_text}</div>
                {cfg.includeClarifications && e.clarifications.length > 0 && (
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
