import { useMemo } from 'react';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import FlowTimeline from '@/components/chronicle/FlowTimeline';
import PageHeader from '@/components/chronicle/PageHeader';
import { Activity, TrendingUp, Calendar, Bell } from 'lucide-react';

const previewIndicators = [
  { icon: TrendingUp, label: 'Records over time', desc: 'See how activity builds across weeks and months' },
  { icon: Calendar, label: 'Activity trends', desc: 'Understand whether events are clustering or spacing out' },
  { icon: Bell, label: 'Follow-ups', desc: 'Track what has changed since events were recorded' },
];

const FlowScreen = () => {
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();

  const repeatedPeople = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => i.people_involved.forEach(p => { counts[p] = (counts[p] || 0) + 1; }));
    return new Set(Object.entries(counts).filter(([, c]) => c >= 2).map(([name]) => name));
  }, [incidents]);

  const mostFrequentPerson = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => i.people_involved.forEach(p => { counts[p] = (counts[p] || 0) + 1; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 && sorted[0][1] >= 2 ? sorted[0][0] : null;
  }, [incidents]);

  if (isLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (incidents.length < 2) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Activity" />

        <div className="px-5 pt-2 pb-4 text-center">
          <Activity className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-foreground mb-1">
            {incidents.length === 0 ? 'No records yet' : 'One record so far'}
          </h3>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            This screen shows how your records build over time — including activity trends, clustering, and changes in pace.
          </p>
        </div>

        {/* Preview indicators */}
        <div className="px-5 mt-2">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-3">
            What you'll see here
          </p>
          <div className="space-y-2.5 opacity-50 pointer-events-none select-none">
            {previewIndicators.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <item.icon className="h-4 w-4 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-foreground/70">{item.label}</p>
                  <p className="text-[12px] text-muted-foreground/60 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Activity" subtitle="Activity over time" />
      <div className="px-5">
        <FlowTimeline
          incidents={incidents}
          repeatedPeople={repeatedPeople}
          totalIncidents={incidents.length}
          mostFrequentPerson={mostFrequentPerson}
        />
      </div>
    </div>
  );
};

export default FlowScreen;
