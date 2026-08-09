// Chronicle V2 (candidate) preview Notebook — thin Dexie adapter over the
// shared, source-agnostic NotebookView.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { V2_BASE } from '../routes';
import { v2DB, type V2Media } from '../db';
import { emptySummary, summariseMedia } from '../media/media';
import NotebookView from '../shared/NotebookView';
import type { NotebookRecord } from '../shared/notebookModel';
import { cloneFilters, entryDate, notebookState, type NotebookFilters } from '../filters';

const NotebookScreen = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState(notebookState.q);
  const [view, setView] = useState<'list' | 'month'>(notebookState.view);
  const [month, setMonth] = useState(notebookState.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(notebookState.selectedDate);
  const [filters, setFilters] = useState<NotebookFilters>(cloneFilters(notebookState.filters));

  const persist = (patch: Partial<typeof notebookState>) => Object.assign(notebookState, patch);

  const entries = useLiveQuery(() => v2DB.entries.toArray(), [], []);
  const mediaRows = useLiveQuery(() => v2DB.media.toArray(), [], [] as V2Media[]);
  const summaries = useMemo(() => summariseMedia(mediaRows), [mediaRows]);

  const records: NotebookRecord[] = useMemo(
    () => entries.map(e => {
      const sum = summaries.get(e.id) ?? emptySummary;
      return {
        id: e.id,
        title: e.title,
        preview: e.original_text || 'Voice record — no written wording.',
        dateKey: entryDate(e),
        recordedAt: e.sealed_at,
        category: e.category,
        recordType: 'incident' as const,
        searchExtras: [e.context ?? '', ...e.clarifications.map(c => c.text)],
        people: e.people,
        inDossier: e.in_dossier,
        hasClarifications: e.clarifications.length > 0,
        clarificationCount: e.clarifications.length,
        hasVoice: sum.hasVoice,
        attachmentCount: sum.attachmentCount,
        attachmentTypes: sum.types,
        chips: ['Sealed'],
      };
    }),
    [entries, summaries],
  );

  return (
    <NotebookView
      records={records}
      q={q}
      onQChange={v => { setQ(v); persist({ q: v }); }}
      filters={filters}
      onFiltersChange={f => { setFilters(f); persist({ filters: cloneFilters(f) }); }}
      view={view}
      onViewChange={v => { setView(v); persist({ view: v }); }}
      month={month}
      onMonthChange={m => { setMonth(m); persist({ month: m, selectedDate: null }); }}
      selectedDate={selectedDate}
      onSelectDate={d => { setSelectedDate(d); persist({ selectedDate: d }); }}
      onOpenRecord={id => navigate(`${V2_BASE}/entry/${id}`)}
      emptyMessage="No records yet. Tap Capture to start."
    />
  );
};

export default NotebookScreen;
