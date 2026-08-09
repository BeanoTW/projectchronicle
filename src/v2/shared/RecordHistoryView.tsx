// Phase 7 — quiet, plain-language record history.
//
// Chronicle's trust model rests on one claim: the original wording never
// changes. This surface makes that visible without technical noise.
//
// Rules:
//   - plain language only, no hashes, no field names, no JSON
//   - never implies legal certification or verification by anyone
//   - collapsed by default so it never competes with the record itself
import { useState } from 'react';

export interface RecordHistoryItem {
  id: string;
  /** e.g. "Category set", "Details updated" */
  label: string;
  at: string;
  /** Optional neutral note, e.g. "added by transcription". */
  note?: string | null;
}

interface Props {
  sealedAt: string;
  items: RecordHistoryItem[];
  /** True when the sealed wording has been changed since it was written. */
  originalWordingChanged?: boolean;
  loading?: boolean;
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const RecordHistoryView = ({ sealedAt, items, originalWordingChanged = false, loading = false }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <section style={{ marginTop: 20 }}>
      <h2 className="proto-h2">Record history</h2>
      <div className="proto-entry">
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          {originalWordingChanged
            ? 'The written wording of this record has been changed since it was first saved. Every change is listed below.'
            : 'The written wording of this record has not changed since it was saved.'}
        </p>
        <p className="proto-help" style={{ marginTop: 6, marginBottom: 0 }}>
          Saved {fmt(sealedAt)}.
          {items.length > 0 && ` ${items.length} later change${items.length === 1 ? '' : 's'} to organisational details.`}
        </p>

        {loading ? (
          <p className="proto-help" style={{ marginTop: 8, marginBottom: 0 }}>Loading history…</p>
        ) : items.length > 0 ? (
          <>
            <button
              className="proto-btn"
              data-variant="ghost"
              style={{ marginTop: 10, minHeight: 32, padding: '4px 10px' }}
              aria-expanded={open}
              onClick={() => setOpen(o => !o)}
            >
              {open ? 'Hide changes' : 'Show changes'}
            </button>
            {open && (
              <ul className="proto-doc-history" style={{ marginTop: 10 }}>
                {items.map(i => (
                  <li key={i.id}>
                    {i.label} · {fmt(i.at)}{i.note ? ` · ${i.note}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
      <p className="proto-help" style={{ marginTop: 6 }}>
        This is Chronicle's own record of what you changed. It is not a certification by anyone else.
      </p>
    </section>
  );
};

export default RecordHistoryView;
