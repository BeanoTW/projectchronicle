// Phase 6B — source-agnostic Notebook view.
//
// Receives already-normalised NotebookRecords plus UI state and callbacks.
// It has no data access of its own: preview (Dexie) and production (local-first
// incidents) adapters both render this component.
//
// The list view is the Chronicle spine: records grouped by month along one
// continuous line, a node for every record, the most recent node in the
// accent colour. It shows the record exactly as written; nothing is inferred.
import FilterSheet from '../components/FilterSheet';
import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';
import MonthView from '../components/MonthView';
import ChronicleEmptyState from '../brand/ChronicleEmptyState';
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
  usefulNotebookPreview,
  uniqueCategories,
  uniquePeople,
  type NotebookRecord,
} from './notebookModel';
import { useMemo, useState, type ReactNode } from 'react';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
});
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, {
  hour: '2-digit', minute: '2-digit',
});
const fmtMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, {
  month: 'long', year: 'numeric',
});
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'undated' : `${d.getFullYear()}-${d.getMonth()}`;
};

interface MonthGroup {
  key: string;
  label: string;
  records: NotebookRecord[];
}

/** Consecutive records that share a month, in the order they are shown. */
function groupByMonth(records: NotebookRecord[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const record of records) {
    const key = monthKey(record.recordedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.records.push(record);
    else groups.push({ key, label: key === 'undated' ? 'Undated' : fmtMonth(record.recordedAt), records: [record] });
  }
  return groups;
}

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
  /** Quiet status line (e.g. Privacy Shield active). */
  notice?: ReactNode;
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
  notice,
}: NotebookViewProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const sorted = useMemo(() => sortByRecency(records), [records]);
  const categories = useMemo(() => uniqueCategories(sorted), [sorted]);
  const people = useMemo(() => uniquePeople(sorted), [sorted]);

  const searched = useMemo(() => sorted.filter(r => recordMatchesSearch(r, q)), [sorted, q]);
  const filtered = useMemo(() => searched.filter(r => recordMatchesFilters(r, filters)), [searched, filters]);
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);
  // The accent node marks the most recent record overall, not merely the first match.
  const latestId = sorted[0]?.id;

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
      <ChroniclePageHeader title={title} eyebrow="Chronological index" subtitle="Browse, filter and return to every record in order." />
      {notice && <p className="proto-help" role="status" style={{ marginBottom: 10 }}>{notice}</p>}

      <div className="proto-toolbar">
        <div className="proto-controls">
          <input
            className="proto-input"
            type="search"
            placeholder="Search records"
            aria-label="Search records"
            value={q}
            onChange={e => onQChange(e.target.value)}
          />
          <div className="proto-viewswitch" role="group" aria-label="View">
            <button data-active={view === 'list'} aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>List</button>
            <button data-active={view === 'month'} aria-pressed={view === 'month'} onClick={() => onViewChange('month')}>Month</button>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <button className="proto-btn proto-filterbtn" onClick={() => setSheetOpen(true)} style={{ width: '100%' }}>
            Filters{count > 0 ? ` · ${count}` : ''}
          </button>
        </div>
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
        <div className="proto-state-error" role="alert">{error}</div>
      ) : loading ? (
        <div aria-busy="true" className="proto-spine">
          <span className="proto-sr">Loading records…</span>
          {[0, 1, 2].map(i => (
            <div className="proto-skeleton-card" key={i} aria-hidden="true">
              <div className="proto-skeleton-line" data-w="meta" />
              <div className="proto-skeleton-line" data-w="title" />
              <div className="proto-skeleton-line" />
              <div className="proto-skeleton-line" data-w="short" />
            </div>
          ))}
        </div>
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
        <ChronicleEmptyState>
          {sorted.length === 0
            ? emptyMessage
            : count > 0 || q
            ? 'No records match your search and filters.'
            : emptyMessage}
        </ChronicleEmptyState>
      ) : (
        <div className="proto-spine">
          {groups.map(group => (
            <section className="proto-spine-month" key={group.key} aria-label={group.label}>
              <h2 className="proto-spine-monthlabel">
                {group.label}
                <span className="proto-spine-monthcount">
                  {group.records.length} {group.records.length === 1 ? 'record' : 'records'}
                </span>
              </h2>
              <ol className="proto-spine-list">
                {group.records.map(r => {
                  const preview = usefulNotebookPreview(r.title, r.preview);
                  const recordType = r.recordType === 'daily' ? 'Daily record' : 'Incident';
                  const statusChips = r.chips.filter(c => c !== 'Incident' && c !== 'Daily record' && c !== r.category);
                  const hasChips =
                    !!r.category || statusChips.length > 0 || r.inDossier || r.attachmentCount > 0 || r.hasClarifications || r.hasVoice;
                  return (
                    <li className="proto-spine-item" key={r.id} data-latest={r.id === latestId}>
                      <span className="proto-spine-node" aria-hidden="true" />
                      <button
                        onClick={() => onOpenRecord(r.id)}
                        className="proto-entry"
                        style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                      >
                        <div className="proto-entry-when">
                          <span>{fmtDate(r.recordedAt)} · {fmtTime(r.recordedAt)}</span>
                          <span className="proto-entry-type">{recordType}</span>
                        </div>
                        {r.title && <div className="proto-entry-title">{r.title}</div>}
                        {preview && <div className="proto-entry-preview">{preview}</div>}
                        {hasChips && (
                          <div className="proto-entry-meta">
                            {r.inDossier && <span className="proto-chip" data-tone="brass">In Chronicle</span>}
                            {r.category && <span className="proto-chip">{r.category}</span>}
                            {statusChips.map(c => <span key={c} className="proto-chip">{c}</span>)}
                            {r.attachmentCount > 0 && (
                              <span className="proto-chip">
                                {r.attachmentCount} attachment{r.attachmentCount === 1 ? '' : 's'}
                              </span>
                            )}
                            {r.hasClarifications && <span className="proto-chip">Clarification added</span>}
                            {r.hasVoice && <span className="proto-chip">Voice</span>}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
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