// Phase 6B — source-agnostic Notebook view.
//
// Receives already-normalised NotebookRecords plus UI state and callbacks.
// It has no data access of its own: preview (Dexie) and production (local-first
// incidents) adapters both render this component.
import FilterSheet from '../components/FilterSheet';
import MonthView from '../components/MonthView';
import {
  activeFilterCount,
  buildChips,
  cloneFilters,
  emptyFilters,
  type NotebookFilters,
} from '../filters';
import {
  recordMatchesFilters,
  recordMatchesSearch,
  sortByRecency,
  uniqueCategories,
  uniquePeople,
  type NotebookRecord,
} from './notebookModel';
import { useMemo, useState } from 'react';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
});
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, {
  hour: '2-digit', minute: '2-digit',
});

export interface NotebookViewProps {
  title?: string;
  records: NotebookRecord[];
  loading?: boolean;
  error?: string | null;
  /** Controlled UI state. */
  q: string;
  onQChange: (q: string) => void;
  filters: NotebookFilters;
  onFiltersChange: (f: NotebookFilters) => void;
  view: 'list' | 'month';
  onViewChange: (v: 'list' | 'month') => void;
  month: string;
  onMonthChange: (m: string) => void;
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
  onOpenRecord: (id: string) => void;
  /** Hide evidence filters when the source has no reliable attachment data. */
  showEvidenceFilters?: boolean;
  showAttachmentTypeFilters?: boolean;
  /** Show the incident / daily-record filter (production has both types). */
  showRecordTypeFilters?: boolean;
  emptyMessage?: string;
}

const NotebookView = ({
  title = 'Notebook',
  records,
  loading = false,
  error = null,
  q,
  onQChange,
  filters,
  onFiltersChange,
  view,
  onViewChange,
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  onOpenRecord,
  showEvidenceFilters = true,
  showAttachmentTypeFilters = true,
  showRecordTypeFilters = false,
  emptyMessage = 'No records yet.',
}: NotebookViewProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const sorted = useMemo(() => sortByRecency(records), [records]);
  const categories = useMemo(() => uniqueCategories(sorted), [sorted]);
  const people = useMemo(() => uniquePeople(sorted), [sorted]);

  const searched = useMemo(() => sorted.filter(r => recordMatchesSearch(r, q)), [sorted, q]);
  const filtered = useMemo(() => searched.filter(r => recordMatchesFilters(r, filters)), [searched, filters]);

  const chips = buildChips(filters);
  const count = activeFilterCount(filters);

  const totalInMonth = useMemo(
    () => sorted.filter(r => r.dateKey.startsWith(month)).length,
    [sorted, month],
  );

  const apply = (f: NotebookFilters) => {
    onFiltersChange(f);
    setSheetOpen(false);
  };

  return (
    <div>
      <h1 className="proto-h1">{title}</h1>

      <div className="proto-controls">
        <input
          className="proto-input"
          placeholder="Search records"
          aria-label="Search records"
          value={q}
          onChange={e => onQChange(e.target.value)}
        />
        <div className="proto-viewswitch" role="group" aria-label="View">
          <button data-active={view === 'list'} onClick={() => onViewChange('list')}>List</button>
          <button data-active={view === 'month'} onClick={() => onViewChange('month')}>Month</button>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <button className="proto-btn" onClick={() => setSheetOpen(true)} style={{ width: '100%' }}>
          Filters{count > 0 ? ` · ${count}` : ''}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="proto-chipwrap" style={{ marginBottom: 12 }}>
          {chips.map(c => (
            <button
              key={c.key}
              className="proto-activechip"
              onClick={() => apply(c.remove(filters))}
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            className="proto-activechip"
            data-tone="clear"
            onClick={() => apply(cloneFilters(emptyFilters))}
          >
            Clear all
          </button>
        </div>
      )}

      {error ? (
        <div className="proto-empty" role="alert">{error}</div>
      ) : loading ? (
        <div className="proto-empty">Loading records…</div>
      ) : view === 'month' ? (
        <MonthView
          month={month}
          entries={filtered}
          totalInMonth={totalInMonth}
          selectedDate={selectedDate}
          onMonthChange={m => { onMonthChange(m); onSelectDate(null); }}
          onSelectDate={onSelectDate}
          onOpenEntry={onOpenRecord}
        />
      ) : filtered.length === 0 ? (
        <div className="proto-empty">
          {sorted.length === 0
            ? emptyMessage
            : count > 0 || q
            ? 'No records match your search and filters.'
            : emptyMessage}
        </div>
      ) : (
        filtered.map(r => (
          <button
            key={r.id}
            onClick={() => onOpenRecord(r.id)}
            className="proto-entry"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <div className="proto-entry-meta">
              <span>{fmtDate(r.recordedAt)} · {fmtTime(r.recordedAt)}</span>
              {r.chips.map(c => <span key={c} className="proto-chip">{c}</span>)}
              {r.hasClarifications && <span className="proto-chip">Clarification added</span>}
              {r.hasVoice && <span className="proto-chip">Voice</span>}
              {r.attachmentCount > 0 && (
                <span className="proto-chip">
                  {r.attachmentCount} attachment{r.attachmentCount === 1 ? '' : 's'}
                </span>
              )}
              {r.inDossier && <span className="proto-chip" data-tone="brass">In dossier</span>}
              {r.category && <span className="proto-chip">{r.category}</span>}
            </div>
            {r.title && (
              <div className="proto-serif" style={{ fontSize: 17, marginBottom: 4 }}>{r.title}</div>
            )}
            <div style={{
              fontSize: 14, lineHeight: 1.5, color: 'var(--p-ink-2)',
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {r.preview}
            </div>
          </button>
        ))
      )}

      <FilterSheet
        open={sheetOpen}
        value={filters}
        categories={categories}
        people={people}
        showEvidence={showEvidenceFilters}
        showAttachmentTypes={showAttachmentTypeFilters}
        showRecordTypes={showRecordTypeFilters}
        onClose={() => setSheetOpen(false)}
        onApply={apply}
      />
    </div>
  );
};

export default NotebookView;
