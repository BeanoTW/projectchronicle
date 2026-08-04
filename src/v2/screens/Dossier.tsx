import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { v2DB, type V2Entry, type V2Media } from '../db';
import { typeLabel, type AttachmentType } from '../media/media';
import { entryDate } from '../filters';
import {
  buildDossierDocument,
  defaultDossierConfig,
  matchesScope,
  DEFAULT_DOSSIER_TITLE,
  type DossierConfig,
} from '../dossier/document';
import { exportDossierPdf } from '../dossier/exportPdf';
import { exportDossierDocx } from '../dossier/exportDocx';
import DossierPreview from '../components/DossierPreview';

const DossierScreen = () => {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<DossierConfig>(defaultDossierConfig);
  const [tab, setTab] = useState<'configure' | 'preview'>('configure');
  const [busy, setBusy] = useState<null | 'pdf' | 'docx'>(null);

  const all = useLiveQuery(async () => v2DB.entries.toArray(), [], []) as V2Entry[];
  const media = useLiveQuery(async () => v2DB.media.toArray(), [], []) as V2Media[];

  const categories = useMemo(
    () => Array.from(new Set(all.map(e => e.category).filter(Boolean) as string[])).sort(),
    [all],
  );
  const people = useMemo(() => Array.from(new Set(all.flatMap(e => e.people))).sort(), [all]);

  /* Records listed for selection, narrowed by the same scope filters. */
  const listed = useMemo(
    () => all.filter(e => matchesScope(e, cfg)).sort((a, b) => b.sealed_at.localeCompare(a.sealed_at)),
    [all, cfg],
  );

  const doc = useMemo(() => buildDossierDocument(all, cfg, media), [all, cfg, media]);

  const filtersActive = !!(cfg.from || cfg.to || cfg.category || cfg.person);
  const clearFilters = () => setCfg({ ...cfg, from: null, to: null, category: null, person: null });

  const toggleMember = (id: string, on: boolean) => v2DB.entries.update(id, { in_dossier: on });

  const runExport = async (kind: 'pdf' | 'docx') => {
    setBusy(kind);
    try {
      const fresh = buildDossierDocument(all, cfg, media);
      if (kind === 'pdf') await exportDossierPdf(fresh, cfg);
      else await exportDossierDocx(fresh, cfg);
    } finally {
      setBusy(null);
    }
  };

  const canExport = doc.records.length > 0;

  return (
    <div>
      <div className="proto-noprint">
        <h1 className="proto-h1">Dossier</h1>
        <p className="proto-help" style={{ marginBottom: 12 }}>
          A document assembled from your sealed records, in chronological order. Original wording is
          never altered.
        </p>

        <div className="proto-viewswitch" style={{ width: '100%', marginBottom: 14 }} role="group" aria-label="Dossier view">
          <button style={{ flex: 1 }} data-active={tab === 'configure'} onClick={() => setTab('configure')}>Configure</button>
          <button style={{ flex: 1 }} data-active={tab === 'preview'} onClick={() => setTab('preview')}>Preview</button>
        </div>
      </div>

      {tab === 'configure' ? (
        <div className="proto-noprint">
          <section className="proto-fgroup">
            <h2 className="proto-flabel">Document title</h2>
            <input
              className="proto-input"
              value={cfg.title}
              placeholder={DEFAULT_DOSSIER_TITLE}
              onChange={e => setCfg({ ...cfg, title: e.target.value })}
            />
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
            <h2 className="proto-flabel">What the document contains</h2>
            <div className="proto-chipwrap">
              <button className="proto-selchip" data-on={cfg.includeDetails}
                onClick={() => setCfg({ ...cfg, includeDetails: !cfg.includeDetails })}>
                Organisational details
              </button>
              <button className="proto-selchip" data-on={cfg.includeClarifications}
                onClick={() => setCfg({ ...cfg, includeClarifications: !cfg.includeClarifications })}>
                Clarifications
              </button>
              <button className="proto-selchip" data-on={cfg.includeHistory}
                onClick={() => setCfg({ ...cfg, includeHistory: !cfg.includeHistory })}>
                Record history
              </button>
            </div>
            <p className="proto-help">
              Organisational details cover the event date, category, context and people recorded.
              These settings change how the document reads, not which records belong to it.
            </p>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Evidence</h2>
            <div className="proto-chipwrap">
              <button className="proto-selchip" data-on={cfg.includeVoice}
                onClick={() => setCfg({ ...cfg, includeVoice: !cfg.includeVoice })}>
                Voice-record references
              </button>
              <button className="proto-selchip" data-on={cfg.includeAttachments}
                onClick={() => setCfg({ ...cfg, includeAttachments: !cfg.includeAttachments })}>
                Attachments
              </button>
            </div>
            {cfg.includeAttachments && (
              <div className="proto-chipwrap" style={{ marginTop: 8 }}>
                {(['image', 'document', 'audio', 'video', 'other'] as AttachmentType[]).map(t => (
                  <button key={t} className="proto-selchip"
                    data-on={cfg.attachmentTypes.includes(t)}
                    onClick={() => setCfg({
                      ...cfg,
                      attachmentTypes: cfg.attachmentTypes.includes(t)
                        ? cfg.attachmentTypes.filter(x => x !== t)
                        : [...cfg.attachmentTypes, t],
                    })}>
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            )}
            <p className="proto-help">
              Evidence always belongs to its record. If a record is not included, none of its
              evidence appears. Individual files can be excluded from within a record’s Evidence
              section. No attachment-type selection means all types are included.
            </p>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Scope</h2>
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

            {categories.length > 0 && (
              <div className="proto-chipwrap" style={{ marginTop: 10 }}>
                {categories.map(c => (
                  <button key={c} className="proto-selchip" data-on={cfg.category === c}
                    onClick={() => setCfg({ ...cfg, category: cfg.category === c ? null : c })}>
                    {c}
                  </button>
                ))}
              </div>
            )}

            {people.length > 0 && (
              <div className="proto-chipwrap" style={{ marginTop: 8 }}>
                {people.map(p => (
                  <button key={p} className="proto-selchip" data-on={cfg.person === p}
                    onClick={() => setCfg({ ...cfg, person: cfg.person === p ? null : p })}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {filtersActive && (
              <button className="proto-btn" data-variant="ghost" style={{ marginTop: 10 }} onClick={clearFilters}>
                Clear scope filters
              </button>
            )}
            <p className="proto-help">
              Scope decides which included records appear in this document. It never adds or removes
              records from the dossier itself.
            </p>
          </section>

          <section className="proto-fgroup">
            <h2 className="proto-flabel">Records</h2>
            {all.length === 0 ? (
              <div className="proto-empty">No records yet. Capture something first.</div>
            ) : listed.length === 0 ? (
              <div className="proto-empty">
                No records match the current scope. Clear the filters to see everything again.
              </div>
            ) : (
              listed.map(e => (
                <label key={e.id} className="proto-selectrow">
                  <input
                    type="checkbox"
                    checked={e.in_dossier}
                    onChange={ev => toggleMember(e.id, ev.target.checked)}
                  />
                  <span>
                    <span className="proto-selectrow-title">
                      {e.title || e.original_text.slice(0, 48) + (e.original_text.length > 48 ? '…' : '')}
                    </span>
                    <span className="proto-help">
                      {new Date(entryDate(e)).toLocaleDateString()}
                      {e.category ? ` · ${e.category}` : ''}
                    </span>
                  </span>
                </label>
              ))
            )}
          </section>

          <p className="proto-help">
            {doc.totalMembers} record{doc.totalMembers === 1 ? '' : 's'} in the dossier
            {doc.hiddenByFilters > 0 ? ` · ${doc.hiddenByFilters} outside the current scope` : ''}
            {doc.records.length === 1 ? ' · this document contains a single record' : ''}.
          </p>
        </div>
      ) : (
        <>
          <div className="proto-noprint proto-exportbar">
            <button className="proto-btn" data-variant="primary" disabled={!canExport || busy !== null}
              onClick={() => runExport('pdf')}>
              {busy === 'pdf' ? 'Preparing…' : 'Export PDF'}
            </button>
            <button className="proto-btn" disabled={!canExport || busy !== null}
              onClick={() => runExport('docx')}>
              {busy === 'docx' ? 'Preparing…' : 'Export Word'}
            </button>
            <button className="proto-btn" data-variant="ghost" disabled={!canExport} onClick={() => window.print()}>
              Print
            </button>
          </div>

          {doc.records.length === 0 && (
            <div className="proto-empty proto-noprint" style={{ marginBottom: 14 }}>
              {doc.totalMembers === 0
                ? 'No records are included yet. Select records in Configure, or open an entry and choose “Include in dossier”.'
                : `All ${doc.totalMembers} included record${doc.totalMembers === 1 ? '' : 's'} fall outside the current scope. Adjust the date range, category or person in Configure.`}
            </div>
          )}

          {doc.hiddenByFilters > 0 && doc.records.length > 0 && (
            <p className="proto-help proto-noprint" style={{ marginBottom: 10 }}>
              {doc.hiddenByFilters} included record{doc.hiddenByFilters === 1 ? ' is' : 's are'} hidden
              by the current scope and will not appear in the export.
            </p>
          )}

          <DossierPreview doc={doc} cfg={cfg} onOpenRecord={id => navigate(`/prototype/entry/${id}`)} />
        </>
      )}
    </div>
  );
};

export default DossierScreen;
