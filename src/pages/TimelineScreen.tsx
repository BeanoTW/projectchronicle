import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Paperclip, BookOpen, List, FileText } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import IncidentCard from '@/components/chronicle/IncidentCard';
import PageHeader from '@/components/chronicle/PageHeader';
import AttachmentsLibrary from '@/components/chronicle/AttachmentsLibrary';
import SummaryBuilderModal from '@/components/chronicle/SummaryBuilderModal';
import NarrativeDayView from '@/components/chronicle/NarrativeDayView';

const categoryFilters = [
  'all',
  'Communication', 'Action / Change', 'Process Event',
  'Pay / Benefits', 'Working Conditions',
  'Observed Behaviour', 'Record Issued', 'Other',
];

/* ── Muted example cards for empty state ── */
const exampleCards = [
  { title: 'Meeting with manager', date: '14 Jan 2025', category: 'Process Event' },
  { title: 'Comment from colleague', date: '22 Jan 2025', category: 'Communication' },
  { title: 'Shift changed without notice', date: '3 Feb 2025', category: 'Action / Change' },
];

const TimelineScreen = () => {
  const { data: allIncidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [gapFilter, setGapFilter] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSummaryBuilder, setShowSummaryBuilder] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'narrative'>('timeline');



  useEffect(() => {
    const gap = searchParams.get('gap');
    if (gap) {
      setGapFilter(gap);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const incidents = useMemo(() => {
    let filtered = [...allIncidents];
    if (filterCategory !== 'all') filtered = filtered.filter(i => i.category === filterCategory);
    if (gapFilter === 'no-evidence') filtered = filtered.filter(i => !allEvidence.some(e => e.incident_id === i.id));
    if (gapFilter === 'no-witnesses') filtered = filtered.filter(i => i.witnesses.length === 0);
    if (gapFilter === 'no-exact-words') filtered = filtered.filter(i => !i.exact_words);
    if (gapFilter === 'no-impact') filtered = filtered.filter(i => !i.impact_note);
    return filtered.sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());
  }, [allIncidents, filterCategory, gapFilter, allEvidence]);

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

  /* ── Empty state ── */
  if (allIncidents.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Timeline" subtitle="Your record over time" />

        <div className="px-5 pt-2 pb-4 text-center">
          <CalendarDays className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-foreground mb-1">No records yet</h3>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Your timeline will show events in order as you record them. Each entry is preserved exactly as you wrote it.
          </p>
        </div>

        {/* Preview example cards */}
        <div className="px-5 mt-2">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-3">
            Example of how records appear
          </p>
          <div className="space-y-2.5 opacity-50 pointer-events-none select-none">
            {exampleCards.map((card, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl px-4 py-3"
              >
                <p className="text-[11px] text-muted-foreground/60 mb-0.5">{card.date}</p>
                <p className="text-[13px] font-medium text-foreground/70">{card.title}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                  {card.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Timeline" subtitle="Your record over time">
        <button
          onClick={() => setShowSummaryBuilder(true)}
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Build a summary"
        >
          <FileText className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
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

          {incidents.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[13px] text-muted-foreground">No records match this filter.</p>
            </div>
          ) : (
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
          )}
        </>
      )}

      {viewMode === 'narrative' && (
        <div className="px-5">
          {wellnessNarrative.paragraphs.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-5 space-y-2.5">
              {wellnessNarrative.paragraphs.map((p, i) => (
                <p key={i} className="text-[13px] text-foreground/80 leading-relaxed">{p}</p>
              ))}
            </div>
          )}

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
      <SummaryBuilderModal open={showSummaryBuilder} onClose={() => setShowSummaryBuilder(false)} incidents={allIncidents} />
    </div>
  );
};

export default TimelineScreen;
