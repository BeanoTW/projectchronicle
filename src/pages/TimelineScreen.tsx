import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Paperclip, BookOpen, List, FileText } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import IncidentCard from '@/components/chronicle/IncidentCard';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import AttachmentsLibrary from '@/components/chronicle/AttachmentsLibrary';
import SummaryBuilderModal from '@/components/chronicle/SummaryBuilderModal';
import { generateNarrative } from '@/lib/narrativeEngine';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [gapFilter, setGapFilter] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'narrative'>('timeline');

  const narrative = useMemo(() => generateNarrative(allIncidents), [allIncidents]);

  useEffect(() => {
    const gap = searchParams.get('gap');
    if (gap) {
      setGapFilter(gap);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Newest-first
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

  const isPartOfPattern = (inc: typeof allIncidents[0]) => {
    if (inc.category && repeatedCategories.has(inc.category)) return true;
    if (inc.people_involved.some(p => repeatedPeople.has(p))) return true;
    return false;
  };

  const getOccurrenceLabel = (inc: typeof allIncidents[0]): string | null => {
    if (inc.category && repeatedCategories.has(inc.category)) {
      const sameCategory = allIncidents
        .filter(i => i.category === inc.category)
        .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());
      const idx = sameCategory.findIndex(i => i.id === inc.id);
      if (idx >= 0) return `Repeated ${idx + 1} times`;
    }
    const repeatedPerson = inc.people_involved.find(p => repeatedPeople.has(p));
    if (repeatedPerson) {
      const count = allIncidents.filter(i => i.people_involved.includes(repeatedPerson)).length;
      return `${repeatedPerson} appears in ${count} records`;
    }
    return null;
  };

  // Grouped by month
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
      <PageHeader title="Timeline" subtitle="Your record over time">
        <button
          onClick={() => setShowLibrary(true)}
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors relative"
          aria-label="Attachments"
        >
          <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.5} />
          {allEvidence.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
              {allEvidence.length}
            </span>
          )}
        </button>
      </PageHeader>

      {/* View toggle */}
      <div className="px-5 mb-3 flex gap-1.5">
        <button
          onClick={() => setViewMode('timeline')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
            viewMode === 'timeline'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
        >
          <List className="h-3 w-3" /> Timeline
        </button>
        <button
          onClick={() => setViewMode('narrative')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
            viewMode === 'narrative'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
        >
          <BookOpen className="h-3 w-3" /> Narrative
        </button>
      </div>

      {gapFilter && (
        <div className="mx-5 mb-3 px-3.5 py-2.5 rounded-lg bg-warm-accent-light text-warm-accent-foreground text-[13px] font-medium flex items-center justify-between border border-warm-accent/15">
          <span>Filtered: {gapFilter.replace('no-', 'missing ').replace('-', ' ')}</span>
          <button onClick={() => setGapFilter(null)} className="text-[13px] underline">Clear</button>
        </div>
      )}

      {viewMode === 'timeline' && (
        <>
          {/* Category chips */}
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

          <div className="px-5">
            <div className="pl-6 timeline-spine space-y-6">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 -ml-6">{month}</h2>
                  <div className="space-y-3">
                    {items.map(inc => {
                      const attachmentCount = allEvidence.filter(e => e.incident_id === inc.id).length;
                      return (
                        <div key={inc.id} className="timeline-node">
                          <IncidentCard
                            incident={inc}
                            showPatternLabel={isPartOfPattern(inc)}
                            occurrenceLabel={getOccurrenceLabel(inc)}
                            attachmentCount={attachmentCount}
                            compact
                            expandable
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {viewMode === 'narrative' && (
        <div className="px-5">
          {/* Context notes */}
          {(narrative.context.clusterNote || narrative.context.repeatedIndividuals.length > 0 || narrative.context.dominantCategory) && (
            <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-1.5">
              {narrative.context.clusterNote && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">{narrative.context.clusterNote}</p>
              )}
              {narrative.context.repeatedIndividuals.map(name => (
                <p key={name} className="text-[12px] text-muted-foreground leading-relaxed">
                  {name} appears across multiple entries in this period.
                </p>
              ))}
              {narrative.context.dominantCategory && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Several entries relate to {narrative.context.dominantCategory.toLowerCase()}.
                </p>
              )}
            </div>
          )}

          {/* Narrative entries */}
          <div className="space-y-3">
            {narrative.entries.map((entry, i) => (
              <p key={entry.id} className="text-[13px] text-foreground leading-relaxed">
                <span className="text-muted-foreground/50 text-[11px] font-medium mr-2">{i + 1}.</span>
                {entry.text}
              </p>
            ))}
          </div>

          {narrative.entries.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-8">No records to narrate.</p>
          )}
        </div>
      )}

      <AttachmentsLibrary open={showLibrary} onClose={() => setShowLibrary(false)} />
    </div>
  );
};

export default TimelineScreen;
