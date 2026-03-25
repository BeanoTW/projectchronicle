import { useMemo } from 'react';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import FlowTimeline from '@/components/chronicle/FlowTimeline';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import { GitBranch } from 'lucide-react';

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
        <PageHeader title="Flow" />
        <EmptyState
          icon={<GitBranch className="h-10 w-10" />}
          heading="Not enough data yet"
          body="Flow will visualise how incidents develop over time as you add more records."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Flow" subtitle="How your records are changing over time" />
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
