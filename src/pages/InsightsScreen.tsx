import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, TrendingUp, CalendarDays, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
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

const PatternsScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();

  const totalIncidents = incidents.length;
  const withAttachments = incidents.filter(i => allEvidence.some(e => e.incident_id === i.id)).length;
  const withWitnesses = incidents.filter(i => i.witnesses.length > 0).length;

  const keyIndividuals = useMemo(() => {
    const peopleData: Record<string, { count: number; firstDate: string; lastDate: string }> = {};
    const sorted = [...incidents].sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());
    sorted.forEach(i => {
      i.people_involved.forEach(p => {
        if (!peopleData[p]) peopleData[p] = { count: 0, firstDate: i.incident_date, lastDate: i.incident_date };
        peopleData[p].count++;
        peopleData[p].lastDate = i.incident_date;
      });
    });
    return Object.entries(peopleData)
      .filter(([, d]) => d.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, d]) => ({ name, ...d }));
  }, [incidents]);

  const categoryPatterns = useMemo(() => {
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    return Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }));
  }, [incidents]);

  const concentratedPeriod = useMemo(() => {
    if (incidents.length < 3) return null;
    const sortedDates = incidents.map(i => new Date(i.incident_date).getTime()).sort();
    for (let i = 0; i < sortedDates.length - 2; i++) {
      if (sortedDates[i + 2] - sortedDates[i] <= 7 * 86400000) return 'Several records are close together in time';
    }
    return null;
  }, [incidents]);

  // Build unique, meaningful patterns (max 5)
  const patterns = useMemo(() => {
    const result: string[] = [];

    // Timing cluster
    if (concentratedPeriod) result.push(concentratedPeriod);

    // Repeated people
    keyIndividuals.slice(0, 2).forEach(({ name, count }) => {
      result.push(`${name} appears in ${count} records`);
    });

    // Category grouping
    const topCat = categoryPatterns[0];
    if (topCat && topCat.count >= 3) {
      result.push(`${topCat.category} appears in multiple records`);
    }

    // Gaps
    if (withAttachments === 0 && totalIncidents > 0) {
      result.push('None of your records include attachments yet');
    }
    if (withWitnesses === 0 && totalIncidents > 0) {
      result.push('No witnesses have been recorded');
    }

    return result.slice(0, 5);
  }, [concentratedPeriod, keyIndividuals, categoryPatterns, withAttachments, withWitnesses, totalIncidents]);

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

  const chartData = useMemo(() => {
    const months: Record<string, { name: string; count: number }> = {};
    incidents.forEach(i => {
      const d = new Date(i.incident_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleString('default', { month: 'short' });
      if (!months[key]) months[key] = { name, count: 0 };
      months[key].count++;
    });
    return Object.values(months);
  }, [incidents]);

  if (isLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (incidents.length < 2) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-5 pt-8"><h1>Patterns</h1></div>
        <EmptyState icon={<BarChart3 className="h-10 w-10" />} heading="Not enough data yet" body="Patterns will become clearer as you add more records." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Patterns" subtitle="What your records show so far." />

      {/* Overview stats */}
      <div className="mx-5 mb-6 bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[22px] font-bold text-foreground tabular-nums">{totalIncidents}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">recorded</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-foreground tabular-nums">{withAttachments}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">with attachments</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-foreground tabular-nums">{withWitnesses}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">with witnesses</p>
          </div>
        </div>
        {withAttachments < totalIncidents && (
          <p className="text-[11px] text-muted-foreground/60 text-center mt-3 pt-3 border-t border-border/50">
            {totalIncidents - withAttachments} record{totalIncidents - withAttachments > 1 ? 's have' : ' has'} no attachments yet
          </p>
        )}
      </div>

      {/* Accordion sections */}
      <div className="mx-5 mb-6">
        <Accordion type="multiple" className="space-y-2">
          {/* Patterns in your records */}
          {patterns.length > 0 && (
            <AccordionItem value="patterns" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </span>
                  Patterns in your records
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10">
                  <p className="text-[11px] text-muted-foreground/60 mb-3">What's starting to show up over time</p>
                  <div className="space-y-2">
                    {patterns.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          // Try to navigate to filtered timeline for people patterns
                          const personMatch = p.match(/^(.+) appears in \d+ records$/);
                          if (personMatch) {
                            navigate(`/timeline?person=${encodeURIComponent(personMatch[1])}`);
                          }
                        }}
                        className="block w-full text-left text-[13px] text-body leading-relaxed hover:text-foreground transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* People involved */}
          {keyIndividuals.length > 0 && (
            <AccordionItem value="people" className="border rounded-xl overflow-hidden bg-rep/50 border-rep-foreground/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-rep-foreground/10 text-rep-foreground">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  People involved
                  <span className="text-[12px] text-muted-foreground font-normal">({keyIndividuals.length})</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 flex flex-wrap gap-2">
                  {keyIndividuals.map(({ name, count }) => (
                    <button
                      key={name}
                      onClick={() => navigate(`/timeline?person=${encodeURIComponent(name)}`)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-rep-foreground/8 text-rep-foreground border border-rep-foreground/12 hover:bg-rep-foreground/12 transition-colors"
                    >
                      {name} <span className="text-rep-foreground/50 ml-1">({count})</span>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Categories */}
          {categoryPatterns.length > 0 && (
            <AccordionItem value="categories" className="border rounded-xl overflow-hidden bg-info/[0.03] border-info/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-info/10 text-info">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </span>
                  Categories
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10 flex flex-wrap gap-1.5">
                  {categoryPatterns.slice(0, 5).map(({ category, count }) => (
                    <span key={category} className="px-2 py-0.5 rounded text-[11px] font-medium bg-info/6 text-info border border-info/12">
                      {category} ({count})
                    </span>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* When things are happening */}
          {chartData.length > 0 && (
            <AccordionItem value="timing" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </span>
                  When things are happening
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10">
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={20} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {chartData.map((_, index) => (
                            <Cell key={index} fill="hsl(var(--primary))" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Things you could add */}
          {dataGaps.length > 0 && (
            <AccordionItem value="gaps" className="border rounded-xl overflow-hidden bg-warm-accent/[0.03] border-warm-accent/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-warm-accent/10 text-warm-accent">
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

export default PatternsScreen;
