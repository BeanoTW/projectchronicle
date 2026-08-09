// Phase 6B — migrated production Notebook route (behind the `v2Notebook` flag).
//
// Real production data only. Read-only: navigation + filter state.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIncidents } from '@/hooks/useIncidents';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import { useEvidence } from '@/hooks/useEvidence';
import NotebookView from '@/v2/shared/NotebookView';
import { toNotebookRecords } from '@/v2/shared/productionNotebookAdapter';
import { cloneFilters, emptyFilters, type NotebookFilters } from '@/v2/filters';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useMemo } from 'react';
import '@/v2/styles.css';
import { useOwnNavigationV2 } from '@/components/chronicle/NavigationOwnership';

/** Session-scoped UI state so the view survives navigation to a record and back. */
const prodNotebookState: {
  q: string;
  view: 'list' | 'month';
  month: string;
  selectedDate: string | null;
  filters: NotebookFilters;
} = {
  q: '',
  view: 'list',
  month: new Date().toISOString().slice(0, 7),
  selectedDate: null,
  filters: cloneFilters(emptyFilters),
};

const NotebookScreenV2 = () => {
  // V2 owns navigation on this surface; the legacy V1 bottom nav is not mounted.
  useOwnNavigationV2();
  const navigate = useNavigate();
  const { data: incidents, isLoading } = useIncidents();
  const { data: notes } = useAllFollowUpNotes();
  const evidenceQuery = useEvidence();
  const privacy = usePrivacy();
  const { enabled: shielded } = privacy;

  const [q, setQ] = useState(prodNotebookState.q);
  const [view, setView] = useState<'list' | 'month'>(prodNotebookState.view);
  const [month, setMonth] = useState(prodNotebookState.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(prodNotebookState.selectedDate);
  const [filters, setFilters] = useState<NotebookFilters>(cloneFilters(prodNotebookState.filters));

  const persist = (patch: Partial<typeof prodNotebookState>) => Object.assign(prodNotebookState, patch);

  // Attachment data is only trustworthy once the evidence query has resolved.
  const evidenceReady = evidenceQuery.isSuccess && !evidenceQuery.isError;

  const records = useMemo(
    () => toNotebookRecords({
      incidents: incidents ?? [],
      notes: notes ?? [],
      evidence: evidenceReady ? evidenceQuery.data : undefined,
    }),
    [incidents, notes, evidenceReady, evidenceQuery.data],
  );

  // Privacy Shield: display-only masking. Search still matches the real wording,
  // which is kept in `searchExtras` so shielded users can still find records.
  const shownRecords = useMemo(() => {
    if (!shielded) return records;
    return records.map(r => ({
      ...r,
      title: r.title ? privacy.maskEntities(r.title, { people_involved: r.people }) : r.title,
      preview: privacy.maskText(r.preview, { preview: true }),
      people: privacy.maskNames(r.people),
      searchExtras: [...r.searchExtras, r.preview, r.title ?? '', ...r.people],
    }));
  }, [records, shielded, privacy]);

  return (
    <div className="proto-root proto-surface">
      <div className="proto-page">
        <NotebookView
          title="Notebook"
          records={shownRecords}
          loading={isLoading}
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
          onOpenRecord={id => navigate(`/incident/${id}`)}
          // Voice + attachment flags come from production data; attachment TYPE
          // filters stay hidden until per-file types are reliable offline.
          showEvidenceFilters={evidenceReady}
          showAttachmentTypeFilters={false}
          showRecordTypeFilters
          notice={shielded ? 'Privacy Shield is on — names and wording are hidden on screen only.' : undefined}
          emptyMessage="No records yet."
        />
      </div>
    </div>
  );
};

export default NotebookScreenV2;
