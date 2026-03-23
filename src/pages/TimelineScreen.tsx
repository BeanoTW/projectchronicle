import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import IncidentCard from '@/components/chronicle/IncidentCard';
import ChronologyTimeline from '@/components/chronicle/ChronologyTimeline';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import CategoryBadge from '@/components/chronicle/CategoryBadge';

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
  const [chronologyMode, setChronologyMode] = useState(false);

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
    return filtered.sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());
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
        <div className="px-5 pt-8">
          <h1>Timeline</h1>
        </div>
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
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="chronology" className="text-[11px] text-muted-foreground">Chronology</Label>
            <Switch id="chronology" checked={chronologyMode} onCheckedChange={setChronologyMode} />
          </div>
          <span className="text-[9px] text-muted-foreground/50">View style</span>
        </div>
      </PageHeader>
      <p className="px-5 -mt-2 mb-3 text-[12px] text-muted-foreground/60">Your record over time</p>

      {gapFilter && (
        <div className="mx-5 mb-3 px-3.5 py-2.5 rounded-lg bg-warm-accent-light text-warm-accent-foreground text-[13px] font-medium flex items-center justify-between border border-warm-accent/15">
          <span>Filtered: {gapFilter.replace('no-', 'missing ').replace('-', ' ')}</span>
          <button onClick={() => setGapFilter(null)} className="text-[13px] underline">Clear</button>
        </div>
      )}

      {/* Horizontal scrollable category chips */}
      {!chronologyMode && (
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
        {chronologyMode ? (
          /* ===== CENTER-LINE CHRONOLOGY ===== */
          <ChronologyTimeline incidents={incidents} isPartOfPattern={isPartOfPattern} />
        ) : (
          <div className="pl-6 timeline-spine space-y-5">
            {Object.entries(grouped).map(([month, items]) => (
              <div key={month}>
                <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 -ml-6">{month}</h2>
                <div className="space-y-2.5">
                  {items.map(inc => (
                    <div key={inc.id} className="timeline-node">
                      <IncidentCard incident={inc} showPatternLabel={isPartOfPattern(inc)} compact expandable />
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
