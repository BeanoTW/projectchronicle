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
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [chronologyMode, setChronologyMode] = useState(false);

  const incidents = useMemo(() => {
    let filtered = [...allIncidents];
    if (filterCategory !== 'all') filtered = filtered.filter(i => i.category === filterCategory);
    return filtered.sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());
  }, [allIncidents, filterCategory]);

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
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (incidents.length === 0 && filterCategory === 'all') {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-6">
          <h1 className="text-2xl font-bold text-foreground">Timeline</h1>
        </div>
        <EmptyState
          icon={<CalendarDays className="h-12 w-12" />}
          heading="No incidents yet"
          body="Your timeline will appear here as you record incidents."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-foreground">Timeline</h1>
          <div className="flex items-center gap-2">
            <Label htmlFor="chronology" className="text-xs text-muted-foreground">Chronology View</Label>
            <Switch id="chronology" checked={chronologyMode} onCheckedChange={setChronologyMode} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Ordered by incident date, not recording date.</p>
      </div>

      {!chronologyMode && (
        <div className="px-4 py-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="bg-card text-xs h-8">
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
          <div className="space-y-2 pt-2">
            {incidents.map(inc => (
              <div key={inc.id} className="text-sm leading-relaxed">
                <span className="text-muted-foreground">{format(parseISO(inc.incident_date), 'dd MMM')}</span>
                {' — '}
                <span className="text-foreground">{inc.title || 'Untitled incident'}</span>
                {isPartOfPattern(inc) && (
                  <span className="ml-2 text-[10px] text-severity-serious font-medium">• pattern</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-foreground mb-2">{month}</h2>
              <div className="space-y-3">
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
