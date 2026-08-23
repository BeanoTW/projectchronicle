// Production Notebook route. Reads are legacy-compatible until the audited
// canonical activation receipt exists for the signed-in owner.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotebookView from '@/chronicle/shared/NotebookView';
import { canonicalRecordsToNotebookRecords } from '@/chronicle/shared/canonicalNotebookAdapter';
import { canonicalReadRouter } from '@/chronicle/model/canonicalActivation';
import { localDB } from '@/local/db';
import { cloneFilters, type NotebookFilters } from '@/chronicle/filters';
import { notebookUiState as prodNotebookState } from '@/chronicle/shared/notebookUiState';
import AppSurface from '@/chronicle/shared/AppSurface';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useAuth } from '@/contexts/AuthContext';
import '@/chronicle/styles.css';

const NotebookScreenV2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const privacy = usePrivacy();
  const { enabled: shielded } = privacy;
  const [records, setRecords] = useState<ReturnType<typeof canonicalRecordsToNotebookRecords>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [q, setQ] = useState(prodNotebookState.q);
  const [view, setView] = useState<'list' | 'month'>(prodNotebookState.view);
  const [month, setMonth] = useState(prodNotebookState.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(prodNotebookState.selectedDate);
  const [filters, setFilters] = useState<NotebookFilters>(cloneFilters(prodNotebookState.filters));

  const persist = (patch: Partial<typeof prodNotebookState>) => Object.assign(prodNotebookState, patch);

  useEffect(() => {
    let cancelled = false;
    const ownerId = user?.id;
    if (!ownerId) {
      setRecords([]);
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    setIsLoading(true);
    void (async () => {
      // The router is the cutover boundary: without a valid activation receipt
      // this list is projected from V1; after activation it comes from the
      // canonical store. The screen itself cannot bypass that decision.
      const canonical = await canonicalReadRouter.list(ownerId);
      const people = await localDB.canonical_people.where('owner_id').equals(ownerId).toArray();
      const peopleById = new Map(people.map(person => [person.id, person.display_name]));
      if (!cancelled) setRecords(canonicalRecordsToNotebookRecords(canonical, peopleById));
    })()
      .catch(() => { if (!cancelled) setRecords([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [user?.id]);

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
    <AppSurface>
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
          showEvidenceFilters={false}
          showAttachmentTypeFilters={false}
          showRecordTypeFilters
          notice={shielded ? 'Privacy Shield is on — names and wording are hidden on screen only.' : undefined}
          emptyMessage="No records yet."
        />
      </div>
    </AppSurface>
  );
};

export default NotebookScreenV2;
