import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import IncidentCard from '@/components/chronicle/IncidentCard';
import EmptyState from '@/components/chronicle/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (incidents.length === 0 && filterCategory === 'all') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Timeline</h1>
        </div>
        <EmptyState
          icon={<CalendarDays className="h-12 w-12" />}
          heading="No incidents yet"
          body="You're starting to build a picture — your timeline will appear here as you record more."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Timeline</h1>
          <div className="flex items-center gap-2">
            <Label htmlFor="chronology" className="text-[12px] text-muted-foreground">Chronology</Label>
            <Switch id="chronology" checked={chronologyMode} onCheckedChange={setChronologyMode} />
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground">Sorted by when events happened.</p>
      </div>

      {gapFilter && (
        <div className="mx-4 mb-3 px-3.5 py-2.5 rounded-xl bg-primary/8 text-primary text-[13px] font-medium flex items-center justify-between border border-primary/15">
          <span>Filtered: {gapFilter.replace('no-', 'missing ').replace('-', ' ')}</span>
          <button onClick={() => setGapFilter(null)} className="text-[13px] underline">Clear</button>
        </div>
      )}

      {!chronologyMode && (
        <div className="px-4 py-2">
          <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setGapFilter(null); }}>
            <SelectTrigger className="bg-card text-[13px] h-10 rounded-xl">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {['Verbal Comment','Written Communication','Safety Concern','Scheduling or Shift Change','Disciplinary Meeting','Management Conduct','Pay or Payroll Issue','Policy Application','Workplace Meeting','Other'].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="px-4 space-y-4">
        {chronologyMode ? (
          <div className="space-y-3 pt-2">
            {incidents.map(inc => (
              <div key={inc.id} className="text-[14px] leading-relaxed">
                <span className="text-muted-foreground">{format(parseISO(inc.incident_date), 'dd MMM')}</span>
                {' — '}
                <span className="text-foreground">{inc.title || 'Untitled incident'}</span>
                {isPartOfPattern(inc) && (
                  <span className="ml-2 text-[11px] text-severity-serious font-medium">• Repeated behaviour</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{month}</h2>
              <div className="space-y-2.5">
                {items.map(inc => (
                  <IncidentCard key={inc.id} incident={inc} showPatternLabel={isPartOfPattern(inc)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TimelineScreen;
