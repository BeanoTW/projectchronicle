import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface Insight {
  id: string;
  fact: string;
  explanation: string;
}

const InsightsScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();

  const sorted = useMemo(
    () => [...incidents].sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime()),
    [incidents]
  );

  // --- Activity over time insights ---
  const activityInsights = useMemo(() => {
    if (sorted.length < 2) return [] as Insight[];
    const results: Insight[] = [];
    const seen = new Set<string>();

    // Ascending for cluster detection
    const asc = [...sorted].reverse();

    // Clustering: 3+ within 7 days
    for (let i = 0; i < asc.length - 2; i++) {
      const d1 = new Date(asc[i].incident_date).getTime();
      const d3 = new Date(asc[i + 2].incident_date).getTime();
      if (d3 - d1 <= 7 * 86400000) {
        let count = 3;
        for (let j = i + 3; j < asc.length; j++) {
          if (new Date(asc[j].incident_date).getTime() - d1 <= 7 * 86400000) count++;
          else break;
        }
        const key = `cluster-${count}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: key,
            fact: `${count} records occurred within 7 days`,
            explanation: 'These events occurred in a short time period',
          });
        }
        break;
      }
    }

    // Gap: between consecutive records (descending order), pick most recent meaningful gap
    // Skip the gap that includes the most recent record (i=0)
    let bestGap = { days: 0, index: -1 };
    for (let i = 1; i < sorted.length - 1; i++) {
      const gap = differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i + 1].incident_date));
      if (gap > bestGap.days) {
        bestGap = { days: gap, index: i };
      }
    }
    // Fallback: if no gap found excluding index 0, check index 0 but only if it's not the most recent
    if (bestGap.days <= 14 && sorted.length >= 2) {
      const gap0 = differenceInDays(parseISO(sorted[0].incident_date), parseISO(sorted[1].incident_date));
      if (gap0 > 14 && gap0 > bestGap.days) {
        bestGap = { days: gap0, index: 0 };
      }
    }
    if (bestGap.days > 14) {
      results.push({
        id: `gap-${bestGap.days}`,
        fact: `No incidents recorded for ${bestGap.days} days`,
        explanation: 'There was a significant pause between entries',
      });
    }

    // Frequency trend
    if (asc.length >= 4) {
      const mid = Math.floor(asc.length / 2);
      const firstHalf = asc.slice(0, mid);
      const secondHalf = asc.slice(mid);
      const firstSpan = differenceInDays(parseISO(firstHalf[firstHalf.length - 1].incident_date), parseISO(firstHalf[0].incident_date)) || 1;
      const secondSpan = differenceInDays(parseISO(secondHalf[secondHalf.length - 1].incident_date), parseISO(secondHalf[0].incident_date)) || 1;
      const firstRate = firstHalf.length / firstSpan;
      const secondRate = secondHalf.length / secondSpan;
      if (secondRate > firstRate * 1.5) {
        results.push({
          id: 'freq-increase',
          fact: 'Records are becoming more frequent',
          explanation: 'Entries are closer together than earlier records',
        });
      } else if (firstRate > secondRate * 1.5) {
        results.push({
          id: 'freq-decrease',
          fact: 'Records are becoming less frequent',
          explanation: 'Entries are more spread out than earlier records',
        });
      }
    }

    return results;
  }, [sorted]);

  // --- People ---
  const keyIndividuals = useMemo(() => {
    const peopleData: Record<string, number> = {};
    incidents.forEach(i => {
      i.people_involved.forEach(p => {
        peopleData[p] = (peopleData[p] || 0) + 1;
      });
    });
    return Object.entries(peopleData)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [incidents]);

  // --- Categories ---
  const categoryPatterns = useMemo(() => {
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    return Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }));
  }, [incidents]);

  // --- Summary line ---
  const summaryLine = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${incidents.length} record${incidents.length !== 1 ? 's' : ''}`);
    
    const freqInsight = activityInsights.find(i => i.id.startsWith('freq-'));
    if (freqInsight) {
      parts.push(freqInsight.id === 'freq-increase' ? 'Activity increasing' : 'Activity decreasing');
    }
    
    if (keyIndividuals.length > 0) {
      parts.push(`${keyIndividuals[0].name} appears most`);
    }
    
    return parts.join(' · ');
  }, [incidents.length, activityInsights, keyIndividuals]);

  // --- Data gaps ---
  const dataGaps = useMemo(() => {
    const gaps: { label: string; count: number; action: string; filterKey: string }[] = [];
    const noAttach = incidents.filter(i => !allEvidence.some(e => e.incident_id === i.id)).length;
    if (noAttach > 0) gaps.push({ label: 'no attachments yet', count: noAttach, action: 'Add an attachment', filterKey: 'no-evidence' });
    const noWitness = incidents.filter(i => i.witnesses.length === 0).length;
    if (noWitness > 0) gaps.push({ label: 'no witnesses', count: noWitness, action: 'Add witnesses if available', filterKey: 'no-witnesses' });
    const noExactWords = incidents.filter(i => !i.exact_words).length;
    if (noExactWords > 0) gaps.push({ label: 'no exact wording', count: noExactWords, action: 'Add exact wording if remembered', filterKey: 'no-exact-words' });
    const noImpact = incidents.filter(i => !i.impact_note).length;
    if (noImpact > 0) gaps.push({ label: 'no impact notes', count: noImpact, action: 'Add impact details', filterKey: 'no-impact' });
    return gaps;
  }, [incidents, allEvidence]);

  if (isLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (incidents.length < 2) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-5 pt-8"><h1 className="text-[20px] font-semibold text-foreground">What your records show</h1></div>
        <EmptyState icon={<BarChart3 className="h-10 w-10" />} heading="Not enough data yet" body="Patterns will become clearer as you add more records." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="What your records show" />

      {/* Summary line */}
      <div className="mx-5 mb-5 px-4 py-3 bg-card border border-border rounded-xl">
        <p className="text-[13px] text-foreground font-medium">{summaryLine}</p>
      </div>

      {/* Accordion sections */}
      <div className="mx-5 mb-6">
        <Accordion type="multiple" defaultValue={['activity']} className="space-y-2">
          {/* Activity over time */}
          {activityInsights.length > 0 && (
            <AccordionItem value="activity" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  Activity over time
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {activityInsights.map((insight) => (
                    <div key={insight.id}>
                      <p className="text-[13px] text-foreground font-medium leading-relaxed">{insight.fact}</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{insight.explanation}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* People appearing */}
          {keyIndividuals.length > 0 && (
            <AccordionItem value="people" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  People appearing
                  <span className="text-[12px] text-muted-foreground font-normal">({keyIndividuals.length})</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {keyIndividuals.map(({ name, count }) => (
                    <button
                      key={name}
                      onClick={() => navigate(`/timeline?person=${encodeURIComponent(name)}`)}
                      className="block w-full text-left"
                    >
                      <p className="text-[13px] text-foreground font-medium">{name} appears in {count} records</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">This individual is present across multiple entries</p>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Categories */}
          {categoryPatterns.length > 0 && (
            <AccordionItem value="categories" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </span>
                  Categories
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-3">
                  {categoryPatterns.slice(0, 5).map(({ category, count }, i) => (
                    <div key={category}>
                      <p className="text-[13px] text-foreground font-medium">{category} — {count} record{count > 1 ? 's' : ''}</p>
                      {i === 0 && <p className="text-[12px] text-muted-foreground mt-0.5">Most common category across your entries</p>}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Things you could add */}
          {dataGaps.length > 0 && (
            <AccordionItem value="gaps" className="border rounded-xl overflow-hidden bg-muted/50 border-border">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                  </span>
                  Things you could add
                  <span className="text-[11px] text-muted-foreground font-normal">(optional)</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 space-y-2">
                  {dataGaps.map((gap, i) => (
                    <button
                      key={i}
                      onClick={() => navigate(`/timeline?gap=${gap.filterKey}`)}
                      className="w-full text-left py-2 hover:opacity-80 transition-opacity"
                    >
                      <p className="text-[13px] text-foreground">{gap.count} record{gap.count > 1 ? 's' : ''} with {gap.label}</p>
                      <p className="text-[12px] text-primary mt-0.5">{gap.action}</p>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
};

export default InsightsScreen;
