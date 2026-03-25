import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, LayoutList, GitBranch, Waypoints } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import IncidentCard from '@/components/chronicle/IncidentCard';
import ChronologyTimeline from '@/components/chronicle/ChronologyTimeline';
import FlowTimeline from '@/components/chronicle/FlowTimeline';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import CategoryBadge from '@/components/chronicle/CategoryBadge';

type ViewMode = 'timeline' | 'chronology' | 'flow';

const categoryFilters = [
  'all',
  'Verbal Comment', 'Written Communication', 'Safety Concern',
  'Scheduling or Shift Change', 'Disciplinary Meeting',
  'Management Conduct', 'Pay or Payroll Issue',
  'Policy Application', 'Workplace Meeting', 'Other',
];

const TimelineScreen = () => {
  const { data: allIncidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();
  const { data: allNotes = [] } = useFollowUpNotes();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [gapFilter, setGapFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  useEffect(() => {
    const gap = searchParams.get('gap');
    if (gap) {
      setGapFilter(gap);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // CRITICAL: Newest-first by default
  const incidents = useMemo(() => {
    let filtered = [...allIncidents];
    if (filterCategory !== 'all') filtered = filtered.filter(i => i.category === filterCategory);
    if (gapFilter === 'no-evidence') filtered = filtered.filter(i => !allEvidence.some(e => e.incident_id === i.id));
    if (gapFilter === 'no-witnesses') filtered = filtered.filter(i => i.witnesses.length === 0);
    if (gapFilter === 'no-exact-words') filtered = filtered.filter(i => !i.exact_words);
    if (gapFilter === 'no-impact') filtered = filtered.filter(i => !i.impact_note);
    return filtered.sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());
  }, [allIncidents, filterCategory, gapFilter, allEvidence]);

  // Pattern detection
  const repeatedCategories = useMemo(() => {
    const catCounts: Record<string, number> = {};
    allIncidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    return new Set(Object.entries(catCounts).filter(([, c]) => c >= 3).map(([cat]) => cat));
  }, [allIncidents]);

  const repeatedPeople = useMemo(() => {
    const peopleCounts: Record<string, number> = {};
    allIncidents.forEach(i => i.people_involved.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; }));
    return new Set(Object.entries(peopleCounts).filter(([, c]) => c >= 2).map(([name]) => name));
  }, [allIncidents]);

  const mostFrequentPerson = useMemo(() => {
    const peopleCounts: Record<string, number> = {};
    allIncidents.forEach(i => i.people_involved.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; }));
    const top = Object.entries(peopleCounts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  }, [allIncidents]);

  const isPartOfPattern = (inc: typeof allIncidents[0]) => {
    if (inc.category && repeatedCategories.has(inc.category)) return true;
    if (inc.people_involved.some(p => repeatedPeople.has(p))) return true;
    return false;
  };

  // Occurrence label: "3rd occurrence" or "X incidents involving [Name]"
  const getOccurrenceLabel = (inc: typeof allIncidents[0]): string | null => {
    if (inc.category && repeatedCategories.has(inc.category)) {
      const sameCategory = allIncidents
        .filter(i => i.category === inc.category)
        .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());
      const idx = sameCategory.findIndex(i => i.id === inc.id);
      if (idx >= 0) {
        const ordinal = idx + 1;
        const suffix = ordinal === 1 ? 'st' : ordinal === 2 ? 'nd' : ordinal === 3 ? 'rd' : 'th';
        return `${ordinal}${suffix} occurrence`;
      }
    }
    const repeatedPerson = inc.people_involved.find(p => repeatedPeople.has(p));
    if (repeatedPerson) {
      const count = allIncidents.filter(i => i.people_involved.includes(repeatedPerson)).length;
      return `${count} incidents involving ${repeatedPerson}`;
    }
    return null;
  };

  // Evidence and note counts for chronology
  const evidenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEvidence.forEach(e => { if (e.incident_id) counts[e.incident_id] = (counts[e.incident_id] || 0) + 1; });
    return counts;
  }, [allEvidence]);

  const noteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allNotes.forEach(n => { counts[n.incident_id] = (counts[n.incident_id] || 0) + 1; });
    return counts;
  }, [allNotes]);

  // Grouped for standard timeline (newest-first)
  const grouped = useMemo(() => {
    const groups: Record<string, typeof incidents> = {};
    incidents.forEach(inc => {
      const key = format(parseISO(inc.incident_date), 'MMMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(inc);
    });
    return groups;
  }, [incidents]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <p className="text-muted-foreground text-[14px]">Loading...</p>
      </div>
    );
  }

  if (incidents.length === 0 && filterCategory === 'all') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-5 pt-8"><h1>Timeline</h1></div>
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          heading="No incidents yet"
          body="Your timeline will appear here as you record incidents."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Timeline">
        {/* 3-way view toggle */}
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {([
            { mode: 'timeline' as ViewMode, icon: LayoutList, label: 'List' },
            { mode: 'flow' as ViewMode, icon: Waypoints, label: 'Flow' },
            { mode: 'chronology' as ViewMode, icon: GitBranch, label: 'Record' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </PageHeader>
      <p className="px-5 -mt-2 mb-3 text-[12px] text-muted-foreground/60">Your record over time</p>

      {gapFilter && (
        <div className="mx-5 mb-3 px-3.5 py-2.5 rounded-lg bg-warm-accent-light text-warm-accent-foreground text-[13px] font-medium flex items-center justify-between border border-warm-accent/15">
          <span>Filtered: {gapFilter.replace('no-', 'missing ').replace('-', ' ')}</span>
          <button onClick={() => setGapFilter(null)} className="text-[13px] underline">Clear</button>
        </div>
      )}

      {/* Category chips — hidden in chronology/flow */}
      {viewMode === 'timeline' && (
        <div className="px-5 pb-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 min-w-max">
            {categoryFilters.map(c => (
              <button
                key={c}
                onClick={() => { setFilterCategory(c); setGapFilter(null); }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
                  filterCategory === c
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5">
        {viewMode === 'flow' ? (
          <FlowTimeline
            incidents={incidents}
            repeatedPeople={repeatedPeople}
            totalIncidents={allIncidents.length}
            mostFrequentPerson={mostFrequentPerson}
          />
        ) : viewMode === 'chronology' ? (
          <ChronologyTimeline
            incidents={incidents}
            isPartOfPattern={isPartOfPattern}
            evidenceCounts={evidenceCounts}
            noteCounts={noteCounts}
            occurrenceLabel={getOccurrenceLabel}
          />
        ) : (
          <div className="pl-6 timeline-spine space-y-6">
            {Object.entries(grouped).map(([month, items]) => (
              <div key={month}>
                <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 -ml-6">{month}</h2>
                <div className="space-y-3">
                  {items.map(inc => (
                    <div key={inc.id} className="timeline-node">
                      <IncidentCard
                        incident={inc}
                        showPatternLabel={isPartOfPattern(inc)}
                        occurrenceLabel={getOccurrenceLabel(inc)}
                        compact
                        expandable
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineScreen;
