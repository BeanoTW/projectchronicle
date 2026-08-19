// Phase 6D — source-agnostic dossier "Configure" panel.
// Pure presentation: every list and every persistence call arrives via props.
import { typeLabel, type AttachmentType } from '../media/mediaCore';
import { DEFAULT_DOSSIER_TITLE, type DossierConfig } from './dossierModel';

export interface ConfigureRow {
  id: string;
  label: string;
  meta: string;
  included: boolean;
}

interface Props {
  cfg: DossierConfig;
  onChange: (next: DossierConfig) => void;
  rows: ConfigureRow[];
  totalRecords: number;
  categories: string[];
  people: string[];
  onToggleMember: (id: string, included: boolean) => void;
  totalMembers: number;
  hiddenByFilters: number;
  includedInDocument: number;
  evidenceNote?: string;
  supportsHistory?: boolean;
  supportsEvidence?: boolean;
  busyId?: string | null;
}

const DEFAULT_EVIDENCE_NOTE =
  'Evidence always belongs to its record. If a record is not included, none of its evidence appears. ' +
  'No attachment-type selection means all types are included.';

const DossierConfigureView = ({
  cfg, onChange, rows, totalRecords, categories, people, onToggleMember,
  totalMembers, hiddenByFilters, includedInDocument, evidenceNote,
  supportsHistory = true, supportsEvidence = true, busyId = null,
}: Props) => {
  const set = (patch: Partial<DossierConfig>) => onChange({ ...cfg, ...patch });
  const activeFilterCount = [cfg.from, cfg.to, cfg.category, cfg.person].filter(Boolean).length;
  const filtersActive = activeFilterCount > 0;

  return (
    <div className="proto-noprint">
      <section className="proto-fgroup">
        <h2 className="proto-flabel">Report title</h2>
        <input
          className="proto-input"
          value={cfg.title}
          placeholder={DEFAULT_DOSSIER_TITLE}
          onChange={e => set({ title: e.target.value })}
        />
      </section>

      <section className="proto-fgroup">
        <h2 className="proto-flabel">Order</h2>
        <div className="proto-chipwrap">
          <button className="proto-selchip" data-on={cfg.order === 'asc'} onClick={() => set({ order: 'asc' })}>
            Oldest first
          </button>
          <button className="proto-selchip" data-on={cfg.order === 'desc'} onClick={() => set({ order: 'desc' })}>
            Newest first
          </button>
        </div>
      </section>

      <section className="proto-fgroup" data-guide="chronicle-options">
        <h2 className="proto-flabel">What the report contains</h2>
        <div className="proto-chipwrap">
          <button className="proto-selchip" data-on={cfg.includeDetails}
            onClick={() => set({ includeDetails: !cfg.includeDetails })}>
            Organisational details
          </button>
          <button className="proto-selchip" data-on={cfg.includeClarifications}
            onClick={() => set({ includeClarifications: !cfg.includeClarifications })}>
            Clarifications
          </button>
          {supportsHistory && (
            <button className="proto-selchip" data-on={cfg.includeHistory}
              onClick={() => set({ includeHistory: !cfg.includeHistory })}>
              Record history
            </button>
          )}
        </div>
        <p className="proto-help">
          Organisational details cover the event date, category, context and people recorded.
          These settings change how the report reads, not which records belong to your Chronicle.
        </p>
      </section>

      {supportsEvidence && (
        <section className="proto-fgroup">
          <h2 className="proto-flabel">Evidence</h2>
          <div className="proto-chipwrap">
            <button className="proto-selchip" data-on={cfg.includeVoice}
              onClick={() => set({ includeVoice: !cfg.includeVoice })}>
              Voice-record references
            </button>
            <button className="proto-selchip" data-on={cfg.includeAttachments}
              onClick={() => set({ includeAttachments: !cfg.includeAttachments })}>
              Attachments
            </button>
          </div>
          {cfg.includeAttachments && (
            <div className="proto-chipwrap" style={{ marginTop: 8 }}>
              {(['image', 'document', 'audio', 'video', 'other'] as AttachmentType[]).map(t => (
                <button key={t} className="proto-selchip"
                  data-on={cfg.attachmentTypes.includes(t)}
                  onClick={() => set({
                    attachmentTypes: cfg.attachmentTypes.includes(t)
                      ? cfg.attachmentTypes.filter(x => x !== t)
                      : [...cfg.attachmentTypes, t],
                  })}>
                  {typeLabel[t]}
                </button>
              ))}
            </div>
          )}
          <p className="proto-help">{evidenceNote ?? DEFAULT_EVIDENCE_NOTE}</p>
        </section>
      )}

      <section className="proto-fgroup" data-guide="chronicle-filters" data-filters-active={filtersActive}>
        <div className="proto-filterhead">
          <h2 className="proto-flabel proto-filterhead-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 5.5h16l-6.2 7.2V19l-3.6-2v-4.3z" />
            </svg>
            Filter records
          </h2>
          {filtersActive && (
            <span className="proto-filterbadge" data-testid="chronicle-filter-count">
              {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}
            </span>
          )}
        </div>
        <p className="proto-help" style={{ marginBottom: 8 }}>
          Filters help you find records. They never change your saved records.
        </p>
        <div className="proto-daterow">
          <label>
            <span className="proto-help">From</span>
            <input className="proto-input" type="date" value={cfg.from ?? ''}
              onChange={e => set({ from: e.target.value || null })} />
          </label>
          <label>
            <span className="proto-help">To</span>
            <input className="proto-input" type="date" value={cfg.to ?? ''}
              onChange={e => set({ to: e.target.value || null })} />
          </label>
        </div>

        {categories.length > 0 && (
          <div className="proto-chipwrap" style={{ marginTop: 10 }}>
            {categories.map(c => (
              <button key={c} className="proto-selchip" data-on={cfg.category === c}
                onClick={() => set({ category: cfg.category === c ? null : c })}>
                {c}
              </button>
            ))}
          </div>
        )}

        {people.length > 0 && (
          <div className="proto-chipwrap" style={{ marginTop: 8 }}>
            {people.map(p => (
              <button key={p} className="proto-selchip" data-on={cfg.person === p}
                onClick={() => set({ person: cfg.person === p ? null : p })}>
                {p}
              </button>
            ))}
          </div>
        )}

        {filtersActive && (
          <button className="proto-btn" data-variant="ghost" style={{ marginTop: 10 }}
            data-testid="chronicle-clear-filters"
            onClick={() => set({ from: null, to: null, category: null, person: null })}>
            Clear filters
          </button>
        )}
        <p className="proto-help">
          Filters decide which included records appear in this document. They never add or remove
          records from your Chronicle itself.
        </p>
      </section>

      <section className="proto-fgroup" data-guide="chronicle-records">
        <h2 className="proto-flabel">Records</h2>
        {totalRecords === 0 ? (
          <div className="proto-empty">No records yet.</div>
        ) : rows.length === 0 ? (
          <div className="proto-empty">
            No records match the current scope. Clear the filters to see everything again.
          </div>
        ) : (
          rows.map(r => (
            <label key={r.id} className="proto-selectrow">
              <input
                type="checkbox"
                checked={r.included}
                disabled={busyId === r.id}
                onChange={ev => onToggleMember(r.id, ev.target.checked)}
              />
              <span>
                <span className="proto-selectrow-title">{r.label}</span>
                <span className="proto-help">{r.meta}</span>
              </span>
            </label>
          ))
        )}
      </section>

      <p className="proto-help">
        {totalMembers} record{totalMembers === 1 ? '' : 's'} in your Chronicle
        {hiddenByFilters > 0 ? ` · ${hiddenByFilters} outside the current scope` : ''}
        {includedInDocument === 1 ? ' · this report contains a single record' : ''}.
      </p>
    </div>
  );
};

export default DossierConfigureView;
