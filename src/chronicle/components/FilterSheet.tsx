import { useEffect, useState } from 'react';
import {
  type NotebookFilters,
  type DossierStatus,
  type RecordTypeFilter,
  cloneFilters,
  emptyFilters,
  activeFilterCount,
} from '../filters';
import { typeLabel, type AttachmentType } from '../media/media';

interface Props {
  open: boolean;
  value: NotebookFilters;
  categories: string[];
  people: string[];
  /** Hide evidence filters when the data source has no reliable attachment data. */
  showEvidence?: boolean;
  showAttachmentTypes?: boolean;
  /** Record-type filter — shown only where both Chronicle record types exist. */
  showRecordTypes?: boolean;
  onClose: () => void;
  onApply: (f: NotebookFilters) => void;
}

const FilterSheet = ({ open, value, categories, people, showEvidence = true, showAttachmentTypes = true, showRecordTypes = false, onClose, onApply }: Props) => {
  const [draft, setDraft] = useState<NotebookFilters>(cloneFilters(value));

  useEffect(() => {
    if (open) setDraft(cloneFilters(value));
  }, [open, value]);

  if (!open) return null;

  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item];

  return (
    <div className="proto-sheet-backdrop" onClick={onClose}>
      <div
        className="proto-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Filter records"
        onClick={e => e.stopPropagation()}
      >
        <div className="proto-sheet-grip" />
        <div className="proto-sheet-head">
          <h2 className="proto-h2" style={{ margin: 0 }}>Filters</h2>
          <button className="proto-btn" data-variant="ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="proto-sheet-body">
          {showRecordTypes && (
          <section className="proto-fgroup">
            <h3 className="proto-flabel">Record type</h3>
            <div className="proto-chipwrap">
              {([['incident', 'Incident'], ['daily', 'Daily record']] as Array<[RecordTypeFilter, string]>).map(([v, label]) => (
                <button
                  key={v}
                  className="proto-fchip"
                  data-on={draft.recordTypes.includes(v)}
                  aria-pressed={draft.recordTypes.includes(v)}
                  onClick={() => setDraft({
                    ...draft,
                    recordTypes: draft.recordTypes.includes(v)
                      ? draft.recordTypes.filter(x => x !== v)
                      : [...draft.recordTypes, v],
                  })}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          )}

          <section className="proto-fgroup">
            <h3 className="proto-flabel">Category</h3>
            {categories.length === 0 ? (
              <p className="proto-help">No categories on any record yet.</p>
            ) : (
              <div className="proto-chipwrap">
                {categories.map(c => (
                  <button
                    key={c}
                    className="proto-selchip"
                    data-on={draft.categories.includes(c)}
                    onClick={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="proto-fgroup">
            <h3 className="proto-flabel">People</h3>
            {people.length === 0 ? (
              <p className="proto-help">No people recorded yet.</p>
            ) : (
              <div className="proto-chipwrap">
                {people.map(p => (
                  <button
                    key={p}
                    className="proto-selchip"
                    data-on={draft.people.includes(p)}
                    onClick={() => setDraft({ ...draft, people: toggle(draft.people, p) })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="proto-fgroup">
            <h3 className="proto-flabel">Date range</h3>
            <div className="proto-daterow">
              <label>
                <span className="proto-help">From</span>
                <input
                  className="proto-input"
                  type="date"
                  value={draft.from ?? ''}
                  onChange={e => setDraft({ ...draft, from: e.target.value || null })}
                />
              </label>
              <label>
                <span className="proto-help">To</span>
                <input
                  className="proto-input"
                  type="date"
                  value={draft.to ?? ''}
                  onChange={e => setDraft({ ...draft, to: e.target.value || null })}
                />
              </label>
            </div>
          </section>

          <section className="proto-fgroup">
            <h3 className="proto-flabel">My Record</h3>
            <div className="proto-chipwrap">
              {([
                ['any', 'Any'],
                ['included', 'In My Record'],
                ['excluded', 'Not in My Record'],
              ] as Array<[DossierStatus, string]>).map(([v, label]) => (
                <button
                  key={v}
                  className="proto-selchip"
                  data-on={draft.dossier === v}
                  onClick={() => setDraft({ ...draft, dossier: v })}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {showEvidence && (
          <section className="proto-fgroup">
            <h3 className="proto-flabel">Evidence</h3>
            <div className="proto-chipwrap">
              <button
                className="proto-selchip"
                data-on={draft.hasVoice}
                onClick={() => setDraft({ ...draft, hasVoice: !draft.hasVoice })}
              >
                Has voice record
              </button>
              <button
                className="proto-selchip"
                data-on={draft.hasAttachments}
                onClick={() => setDraft({ ...draft, hasAttachments: !draft.hasAttachments })}
              >
                Has attachments
              </button>
            </div>
            {showAttachmentTypes && (
            <div className="proto-chipwrap" style={{ marginTop: 8 }}>
              {(['image', 'document', 'audio', 'video', 'other'] as AttachmentType[]).map(t => (
                <button
                  key={t}
                  className="proto-selchip"
                  data-on={draft.attachmentTypes.includes(t)}
                  onClick={() => setDraft({ ...draft, attachmentTypes: toggle(draft.attachmentTypes, t) as AttachmentType[] })}
                >
                  {typeLabel[t]}
                </button>
              ))}
            </div>
            )}
          </section>
          )}

          <section className="proto-fgroup">
            <h3 className="proto-flabel">Clarifications</h3>
            <button
              className="proto-selchip"
              data-on={draft.withClarifications}
              onClick={() => setDraft({ ...draft, withClarifications: !draft.withClarifications })}
            >
              Only records with clarifications
            </button>
          </section>
        </div>

        <div className="proto-sheet-foot">
          <button
            className="proto-btn"
            data-variant="ghost"
            onClick={() => setDraft(cloneFilters(emptyFilters))}
          >
            Clear all
          </button>
          <button className="proto-btn" data-variant="primary" onClick={() => onApply(draft)}>
            Apply{activeFilterCount(draft) > 0 ? ` (${activeFilterCount(draft)})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterSheet;
