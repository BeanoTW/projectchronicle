import { useLiveQuery } from 'dexie-react-hooks';
import { v2DB, type V2Media } from '../db';
import type { DossierConfig, DossierDocumentModel, DossierEvidenceItem } from '../dossier/document';
import { useBlobUrl } from '../media/useBlobUrl';

const EvidenceMedia = ({ item }: { item: DossierEvidenceItem }) => {
  const row = useLiveQuery(() => v2DB.media.get(item.id), [item.id]) as V2Media | undefined;
  const previewable = item.type === 'image' || item.type === 'audio';
  const url = useBlobUrl(previewable ? row?.blob ?? null : null);
  if (!url) return null;
  if (item.type === 'image') return <img className="proto-doc-evimg" src={url} alt={item.description ?? item.name} />;
  return <audio className="proto-audio proto-noprint" controls src={url} preload="metadata" />;
};

const EvidenceBlock = ({ items }: { items: DossierEvidenceItem[] }) => (
  <div className="proto-doc-evidence">
    <p className="proto-doc-label">Evidence</p>
    {items.map(e => (
      <div key={e.id} className="proto-doc-evitem">
        <EvidenceMedia item={e} />
        <p className="proto-doc-fine">
          {e.typeLabel} · {e.name} · {e.sizeLabel}
          {e.durationLabel ? ` · ${e.durationLabel}` : ''}
        </p>
        {e.description && <p className="proto-doc-body">{e.description}</p>}
        <p className="proto-doc-fine">{e.roleLabel} · added {e.addedLabel}</p>
      </div>
    ))}
    <p className="proto-doc-fine">Chronicle has not analysed or verified the contents of these files.</p>
  </div>
);

interface Props {
  doc: DossierDocumentModel;
  cfg: DossierConfig;
  onOpenRecord?: (id: string) => void;
}

/* Paper-like document preview. Structure matches the PDF and DOCX exports exactly. */
const DossierPreview = ({ doc, cfg, onOpenRecord }: Props) => (
  <div className="proto-doc" id="proto-doc">
    {/* Cover */}
    <section className="proto-page proto-doc-cover">
      <h1 className="proto-serif proto-doc-title">{doc.title}</h1>
      <p className="proto-doc-sub">{doc.rangeLabel}</p>
      <p className="proto-doc-sub">
        {doc.records.length} record{doc.records.length === 1 ? '' : 's'}
      </p>
      <p className="proto-doc-fine">Generated {doc.generatedLabel}</p>
      <p className="proto-doc-fine">Original wording preserved. Clarifications shown separately.</p>
    </section>

    {/* Contents */}
    <section className="proto-page">
      <h2 className="proto-doc-h2">Contents</h2>
      <ol className="proto-doc-toc">
        {doc.contents.map((c, i) => (
          <li key={`${c.label}-${i}`} data-kind={c.kind}>{c.label}</li>
        ))}
      </ol>
    </section>

    {/* Overview */}
    <section className="proto-page">
      <h2 className="proto-doc-h2">Overview</h2>
      <dl className="proto-doc-dl">
        <dt>Date range</dt><dd>{doc.rangeLabel}</dd>
        <dt>Records included</dt><dd>{doc.records.length}</dd>
        <dt>People named</dt><dd>{doc.people.length ? doc.people.join(', ') : 'None recorded'}</dd>
        <dt>Categories</dt><dd>{doc.categories.length ? doc.categories.join(', ') : 'None recorded'}</dd>
      </dl>
    </section>

    {/* Chronological record */}
    <section className="proto-page">
      <h2 className="proto-doc-h2">Chronological record</h2>

      {doc.records.length === 0 ? (
        <p className="proto-doc-empty">No records are included in this document.</p>
      ) : (
        doc.records.map(r => (
          <article key={r.id} className="proto-doc-record">
            <h3 className="proto-doc-h3">{r.heading}</h3>
            {r.title && <p className="proto-doc-rectitle">{r.title}</p>}
            <p className="proto-doc-fine">Sealed {r.sealedLabel}</p>

            {cfg.includeDetails && r.details.length > 0 && (
              <dl className="proto-doc-details">
                {r.details.map(d => (
                  <div key={d.label}>
                    <dt>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <p className="proto-doc-label">Original record</p>
            <div className="proto-doc-body">{r.text}</div>

            {cfg.includeClarifications && r.clarifications.length > 0 && (
              <>
                <p className="proto-doc-label">Clarifications added later</p>
                {r.clarifications.map(c => (
                  <div key={c.id} className="proto-doc-clar">
                    <p className="proto-doc-fine">{c.label}</p>
                    <div className="proto-doc-body">{c.text}</div>
                  </div>
                ))}
              </>
            )}

            {r.evidence.length > 0 && <EvidenceBlock items={r.evidence} />}

            {onOpenRecord && (
              <button
                className="proto-btn proto-noprint"
                data-variant="ghost"
                style={{ marginTop: 10, minHeight: 32, padding: '4px 10px' }}
                onClick={() => onOpenRecord(r.id)}
              >
                Open record
              </button>
            )}
          </article>
        ))
      )}
    </section>

    {/* Appendix A */}
    {cfg.includeClarifications && doc.hasClarifications && (
      <section className="proto-page">
        <h2 className="proto-doc-h2">Appendix A — Clarifications</h2>
        <p className="proto-doc-note">
          Every clarification in this document, listed with the record it belongs to.
        </p>
        {doc.records.filter(r => r.clarifications.length > 0).map(r => (
          <div key={r.id} className="proto-doc-appitem">
            <h3 className="proto-doc-h4">{r.heading}</h3>
            {r.clarifications.map(c => (
              <div key={c.id} className="proto-doc-clar">
                <p className="proto-doc-fine">{c.label}</p>
                <div className="proto-doc-body">{c.text}</div>
              </div>
            ))}
          </div>
        ))}
      </section>
    )}

    {/* Appendix B */}
    {cfg.includeHistory && doc.records.length > 0 && (
      <section className="proto-page">
        <h2 className="proto-doc-h2">Appendix B — Record history</h2>
        <p className="proto-doc-note">When each record was written, sealed and added to.</p>
        {doc.records.map(r => (
          <div key={r.id} className="proto-doc-appitem">
            <h3 className="proto-doc-h4">{r.heading}</h3>
            <ul className="proto-doc-history">
              {r.history.map(h => <li key={h}>{h}</li>)}
            </ul>
          </div>
        ))}
      </section>
    )}

    {/* Integrity */}
    <section className="proto-page">
      <h2 className="proto-doc-h2">How this document was assembled</h2>
      {doc.integrity.map(p => <p key={p} className="proto-doc-body" style={{ marginBottom: 10 }}>{p}</p>)}
    </section>
  </div>
);

export default DossierPreview;
