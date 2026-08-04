import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { v2DB, type V2Media } from '../db';
import { emptySummary, summariseMedia } from '../media/media';
import FilterSheet from '../components/FilterSheet';
import MonthView from '../components/MonthView';
import {
  activeFilterCount,
  buildChips,
  cloneFilters,
  emptyFilters,
  matchesFilters,
  matchesSearch,
  notebookState,
  type NotebookFilters,
} from '../filters';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
});
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, {
  hour: '2-digit', minute: '2-digit',
});

const NotebookScreen = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState(notebookState.q);
  const [view, setView] = useState<'list' | 'month'>(notebookState.view);
  const [month, setMonth] = useState(notebookState.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(notebookState.selectedDate);
  const [filters, setFilters] = useState<NotebookFilters>(cloneFilters(notebookState.filters));
  const [sheetOpen, setSheetOpen] = useState(false);

  /* Persist notebook UI state for the session so it survives entry navigation. */
  const persist = (patch: Partial<typeof notebookState>) => Object.assign(notebookState, patch);

  const entries = useLiveQuery(async () => {
    const rows = await v2DB.entries.toArray();
    return rows.sort((a, b) => b.sealed_at.localeCompare(a.sealed_at));
  }, [], []);

  const mediaRows = useLiveQuery(() => v2DB.media.toArray(), [], [] as V2Media[]);
  const summaries = useMemo(() => summariseMedia(mediaRows), [mediaRows]);

  const categories = useMemo(
    () => Array.from(new Set(entries.map(e => e.category).filter(Boolean) as string[])).sort(),
    [entries],
  );
  const people = useMemo(
    () => Array.from(new Set(entries.flatMap(e => e.people))).sort(),
    [entries],
  );

  const searched = useMemo(() => entries.filter(e => matchesSearch(e, q)), [entries, q]);
  const filtered = useMemo(
    () => searched.filter(e => matchesFilters(e, filters, summaries.get(e.id) ?? emptySummary)),
    [searched, filters, summaries],
  );

  const chips = buildChips(filters);
  const count = activeFilterCount(filters);

  const applyFilters = (f: NotebookFilters) => {
    setFilters(f);
    persist({ filters: cloneFilters(f) });
    setSheetOpen(false);
  };

  const totalInMonth = useMemo(
    () => entries.filter(e => (e.event_date ?? e.sealed_at.slice(0, 10)).startsWith(month)).length,
    [entries, month],
  );

  return (
    <div>
      <h1 className="proto-h1">Notebook</h1>

      <div className="proto-controls">
        <input
          className="proto-input"
          placeholder="Search records"
          value={q}
          onChange={e => { setQ(e.target.value); persist({ q: e.target.value }); }}
        />
        <div className="proto-viewswitch" role="group" aria-label="View">
          <button data-active={view === 'list'} onClick={() => { setView('list'); persist({ view: 'list' }); }}>List</button>
          <button data-active={view === 'month'} onClick={() => { setView('month'); persist({ view: 'month' }); }}>Month</button>
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
              onClick={() => applyFilters(c.remove(filters))}
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            className="proto-activechip"
            data-tone="clear"
            onClick={() => applyFilters(cloneFilters(emptyFilters))}
          >
            Clear all
          </button>
        </div>
      )}

      {view === 'month' ? (
        <MonthView
          month={month}
          entries={filtered}
          totalInMonth={totalInMonth}
          selectedDate={selectedDate}
          onMonthChange={m => { setMonth(m); persist({ month: m, selectedDate: null }); }}
          onSelectDate={d => { setSelectedDate(d); persist({ selectedDate: d }); }}
          onOpenEntry={id => navigate(`${V2_BASE}/entry/${id}`)}
        />
      ) : filtered.length === 0 ? (
        <div className="proto-empty">
          {entries.length === 0
            ? 'No records yet. Tap Capture to start.'
            : count > 0 || q
            ? 'No records match your search and filters.'
            : 'No records yet.'}
        </div>
      ) : (
        filtered.map(e => {
          const hasClar = e.clarifications.length > 0;
          const sum = summaries.get(e.id) ?? emptySummary;
          return (
            <button
              key={e.id}
              onClick={() => navigate(`${V2_BASE}/entry/${e.id}`)}
              className="proto-entry"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="proto-entry-meta">
                <span>{fmtDate(e.sealed_at)} · {fmtTime(e.sealed_at)}</span>
                <span className="proto-chip">Sealed</span>
                {hasClar && <span className="proto-chip">Clarification added</span>}
                {sum.hasVoice && <span className="proto-chip">Voice</span>}
                {sum.attachmentCount > 0 && (
                  <span className="proto-chip">
                    {sum.attachmentCount} attachment{sum.attachmentCount === 1 ? '' : 's'}
                  </span>
                )}
                {e.in_dossier && <span className="proto-chip" data-tone="brass">In dossier</span>}
                {e.category && <span className="proto-chip">{e.category}</span>}
              </div>
              {e.title && (
                <div className="proto-serif" style={{ fontSize: 17, marginBottom: 4 }}>{e.title}</div>
              )}
              <div style={{
                fontSize: 14, lineHeight: 1.5, color: 'var(--p-ink-2)',
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {e.original_text || 'Voice record — no written wording.'}
              </div>
            </button>
          );
        })
      )}

      <FilterSheet
        open={sheetOpen}
        value={filters}
        categories={categories}
        people={people}
        onClose={() => setSheetOpen(false)}
        onApply={applyFilters}
      />
    </div>
  );
};

export default NotebookScreen;
