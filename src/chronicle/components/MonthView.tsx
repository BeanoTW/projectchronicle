import { useMemo } from 'react';
import { monthCounts, type NotebookRecord } from '../shared/notebookModel';

interface Props {
  month: string;                 // YYYY-MM
  entries: NotebookRecord[];     // already search+filter matched
  totalInMonth: number;          // matched-before-filters count, for empty-state wording
  selectedDate: string | null;
  onMonthChange: (m: string) => void;
  onSelectDate: (d: string | null) => void;
  onOpenEntry: (id: string) => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const MonthView = ({
  month, entries, totalInMonth, selectedDate, onMonthChange, onSelectDate, onOpenEntry,
}: Props) => {
  const [year, mon] = month.split('-').map(Number);

  const counts = useMemo(() => monthCounts(entries, month), [entries, month]);

  const cells = useMemo(() => {
    const first = new Date(year, mon - 1, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, mon, 0).getDate();
    const out: Array<string | null> = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(`${month}-${String(d).padStart(2, '0')}`);
    }
    return out;
  }, [year, mon, month]);

  const monthMatched = entries.filter(e => e.dateKey.startsWith(month));
  const dayEntries = selectedDate
    ? monthMatched.filter(e => e.dateKey === selectedDate).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    : [];

  return (
    <div>
      <div className="proto-monthbar">
        <button className="proto-btn" data-variant="ghost" aria-label="Previous month"
          onClick={() => { onMonthChange(shiftMonth(month, -1)); onSelectDate(null); }}>
          ‹
        </button>
        <span className="proto-monthtitle">{monthLabel(month)}</span>
        <button className="proto-btn" data-variant="ghost" aria-label="Next month"
          onClick={() => { onMonthChange(shiftMonth(month, 1)); onSelectDate(null); }}>
          ›
        </button>
      </div>

      <div className="proto-cal">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="proto-cal-wd">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const n = counts.get(d) ?? 0;
          const selected = d === selectedDate;
          return (
            <button
              key={i}
              className="proto-cal-day"
              data-has={n > 0}
              data-selected={selected}
              disabled={n === 0}
              onClick={() => onSelectDate(selected ? null : d)}
              aria-label={`${d}, ${n} record${n === 1 ? '' : 's'}`}
            >
              <span className="proto-cal-num">{Number(d.slice(8))}</span>
              {n > 0 && <span className="proto-cal-count">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="proto-dayresults">
        {monthMatched.length === 0 ? (
          <div className="proto-empty">
            {totalInMonth === 0
              ? `No records in ${monthLabel(month)}.`
              : 'No records in this month match your search and filters.'}
          </div>
        ) : !selectedDate ? (
          <p className="proto-help">Select a highlighted date to see that day’s records.</p>
        ) : dayEntries.length === 0 ? (
          <div className="proto-empty">No records on this day.</div>
        ) : (
          <>
            <h2 className="proto-h2">
              {new Date(selectedDate).toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h2>
            {dayEntries.map(e => (
              <button
                key={e.id}
                className="proto-entry"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => onOpenEntry(e.id)}
              >
                <div className="proto-entry-meta">
                  <span>{new Date(e.recordedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  {e.category && <span className="proto-chip">{e.category}</span>}
                  {e.hasClarifications && <span className="proto-chip">Clarified</span>}
                  {e.inDossier && <span className="proto-chip" data-tone="brass">In My Record</span>}
                </div>
                {e.title && <div className="proto-serif" style={{ fontSize: 16, marginBottom: 4 }}>{e.title}</div>}
                <div style={{
                  fontSize: 14, lineHeight: 1.5, color: 'var(--p-ink-2)',
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {e.preview}
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default MonthView;
