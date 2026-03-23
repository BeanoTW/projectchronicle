import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, TrendingUp, Loader2, Eye, ArrowRight, CalendarDays, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import EmptyState from '@/components/chronicle/EmptyState';
import AILabel from '@/components/chronicle/AILabel';
import PageHeader from '@/components/chronicle/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const InsightsScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();
  const { toast } = useToast();
  const [aiSummaries, setAiSummaries] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const totalIncidents = incidents.length;
  const withEvidence = incidents.filter(i => allEvidence.some(e => e.incident_id === i.id)).length;
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
      if (sortedDates[i + 2] - sortedDates[i] <= 7 * 86400000) return '3 incidents were recorded within a 7-day period';
    }
    return null;
  }, [incidents]);

  const dataGaps = useMemo(() => {
    const gaps: { label: string; count: number; action: string; filterKey: string }[] = [];
    const noEvidence = incidents.filter(i => !allEvidence.some(e => e.incident_id === i.id)).length;
    if (noEvidence > 0) gaps.push({ label: 'missing evidence', count: noEvidence, action: 'Add evidence to strengthen records', filterKey: 'no-evidence' });
    const noWitness = incidents.filter(i => i.witnesses.length === 0).length;
    if (noWitness > 0) gaps.push({ label: 'missing witnesses', count: noWitness, action: 'Add witnesses if available', filterKey: 'no-witnesses' });
    const noExactWords = incidents.filter(i => !i.exact_words).length;
    if (noExactWords > 0) gaps.push({ label: 'missing exact wording', count: noExactWords, action: 'Add exact wording if remembered', filterKey: 'no-exact-words' });
    const noImpact = incidents.filter(i => !i.impact_note).length;
    if (noImpact > 0) gaps.push({ label: 'missing impact notes', count: noImpact, action: 'Add impact details if relevant', filterKey: 'no-impact' });
    return gaps;
  }, [incidents, allEvidence]);

  const patterns = useMemo(() => {
    const result: string[] = [];
    keyIndividuals.forEach(({ name, count, firstDate, lastDate }) => {
      result.push(`These records include ${count} incidents involving ${name} between ${format(parseISO(firstDate), 'MMMM yyyy')} and ${format(parseISO(lastDate), 'MMMM yyyy')}.`);
    });
    const topCat = categoryPatterns[0];
    if (topCat && topCat.count >= 3) result.push(`${topCat.category} is the most frequently recorded category (${topCat.count} incidents).`);
    if (concentratedPeriod) result.push(concentratedPeriod);
    return result;
  }, [keyIndividuals, categoryPatterns, concentratedPeriod]);

  const handleAiSummarise = async () => {
    if (patterns.length === 0) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarise-patterns', { body: { patterns } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAiSummaries(data.summaries || []);
    } catch (e) {
      toast({ title: 'Summary failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

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
        <div className="px-5 pt-8"><h1>Insights</h1></div>
        <EmptyState icon={<BarChart3 className="h-10 w-10" />} heading="Not enough data yet" body="Record more incidents to see what's showing up in your records." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <div className="px-5 pt-8 pb-5">
        <h1>Insights</h1>
        <p className="text-[13px] text-muted-foreground mt-1">A summary of what you've recorded so far.</p>
      </div>

      {/* Overview stats */}
      <div className="mx-5 mb-6 bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[22px] font-bold text-foreground tabular-nums">{totalIncidents}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">incidents</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-foreground tabular-nums">{withEvidence}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">with evidence</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-foreground tabular-nums">{withWitnesses}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">with witnesses</p>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="mx-5 mb-6">
        <Accordion type="multiple" className="space-y-2">
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
                <div className="space-y-2.5 ml-10">
                  {keyIndividuals.map(({ name, count, firstDate, lastDate }) => (
                    <p key={name} className="text-[13px] text-body leading-relaxed">
                      <span className="font-medium text-foreground">{name}</span> — {count} incidents ({format(parseISO(firstDate), 'MMM yyyy')} to {format(parseISO(lastDate), 'MMM yyyy')})
                    </p>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Patterns */}
          {categoryPatterns.length > 0 && (
            <AccordionItem value="patterns" className="border rounded-xl overflow-hidden bg-primary/[0.03] border-primary/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </span>
                  Things showing up in your records
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="ml-10">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {categoryPatterns.slice(0, 5).map(({ category, count }) => (
                      <span key={category} className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/6 text-primary border border-primary/12">
                        {category} ({count})
                      </span>
                    ))}
                  </div>

                  {concentratedPeriod && (
                    <p className="text-[13px] text-body leading-relaxed mb-3">{concentratedPeriod}</p>
                  )}

                  {patterns.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-border">
                      {patterns.map((p, i) => (
                        <p key={i} className="text-[13px] text-body leading-relaxed">{p}</p>
                      ))}
                    </div>
                  )}

                  {aiSummaries.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="mb-2"><AILabel /></div>
                      <div className="space-y-2">
                        {aiSummaries.map((s, i) => (
                          <p key={i} className="text-[13px] text-body leading-relaxed">{s}</p>
                        ))}
                      </div>
                    </div>
                  ) : patterns.length > 0 ? (
                    <button onClick={handleAiSummarise} disabled={aiLoading} className="mt-3 text-[13px] text-primary font-medium flex items-center gap-1.5">
                      {aiLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</> : 'Generate Summary'}
                    </button>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* When things are happening */}
          {chartData.length > 0 && (
            <AccordionItem value="timing" className="border rounded-xl overflow-hidden bg-info/[0.03] border-info/15">
              <AccordionTrigger className="px-4 py-3.5 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-info/10 text-info">
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

          {/* Gaps */}
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
                      className="w-full flex items-start justify-between gap-2 text-left py-2 hover:opacity-80 transition-opacity"
                    >
                      <div>
                        <p className="text-[13px] text-foreground">{gap.count} incident{gap.count > 1 ? 's' : ''} {gap.label}</p>
                        <p className="text-[12px] text-primary mt-0.5 flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" /> {gap.action}
                        </p>
                      </div>
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
