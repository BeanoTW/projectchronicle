import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, FileText, Users, TrendingUp, Loader2, Shield, Eye, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import EmptyState from '@/components/chronicle/EmptyState';
import AILabel from '@/components/chronicle/AILabel';
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
        if (!peopleData[p]) {
          peopleData[p] = { count: 0, firstDate: i.incident_date, lastDate: i.incident_date };
        }
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
    return Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }, [incidents]);

  const concentratedPeriod = useMemo(() => {
    if (incidents.length < 3) return null;
    const sortedDates = incidents.map(i => new Date(i.incident_date).getTime()).sort();
    for (let i = 0; i < sortedDates.length - 2; i++) {
      if (sortedDates[i + 2] - sortedDates[i] <= 7 * 86400000) {
        return '3 incidents were recorded within a 7-day period';
      }
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
    if (topCat && topCat.count >= 3) {
      result.push(`${topCat.category} is the most frequently recorded category (${topCat.count} incidents).`);
    }
    if (concentratedPeriod) result.push(concentratedPeriod);
    return result;
  }, [keyIndividuals, categoryPatterns, concentratedPeriod]);

  const handleAiSummarise = async () => {
    if (patterns.length === 0) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarise-patterns', {
        body: { patterns },
      });
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
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (incidents.length < 2) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6"><h1 className="text-xl font-bold text-foreground tracking-tight">Insights</h1></div>
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          heading="Not enough data yet"
          body="Record more incidents to see what's showing up in your records."
        />
      </div>
    );
  }

  const overviewCards = [
    { label: 'Total incidents', value: totalIncidents, icon: FileText },
    { label: 'With evidence', value: withEvidence, icon: FileText },
    { label: 'With witnesses', value: withWitnesses, icon: Users },
  ];

  return (
    <div className="min-h-screen bg-tint-insights pb-24">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Insights</h1>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">This is a summary of what you've recorded so far.</p>
      </div>

      {/* Overview */}
      <div className="px-4 grid grid-cols-3 gap-2.5 mb-5">
        {overviewCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card/80 border border-border/50 rounded-2xl p-4 text-center shadow-[var(--shadow-card)]">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mx-auto mb-2">
              <Icon className="h-4 w-4 text-secondary-foreground" />
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Accordion sections */}
      <div className="mx-4 mb-4">
        <Accordion type="multiple" defaultValue={['patterns']} className="space-y-2.5">

          {/* People involved */}
          {keyIndividuals.length > 0 && (
            <AccordionItem value="people" className="bg-card border border-border rounded-xl shadow-[var(--shadow-card)] overflow-hidden px-1">
              <AccordionTrigger className="px-3 py-4 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><Users className="h-3.5 w-3.5 text-secondary-foreground" /></div>
                  People involved
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <div className="space-y-3">
                  {keyIndividuals.map(({ name, count, firstDate, lastDate }) => (
                    <div key={name} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-[7px]" />
                      <p className="text-[14px] text-body leading-relaxed">
                        <span className="font-medium">{name}</span> — {count} incidents ({format(parseISO(firstDate), 'MMM yyyy')} to {format(parseISO(lastDate), 'MMM yyyy')})
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Types of situations */}
          {categoryPatterns.length > 0 && (
            <AccordionItem value="patterns" className="bg-card border border-border rounded-xl shadow-[var(--shadow-card)] overflow-hidden px-1">
              <AccordionTrigger className="px-3 py-4 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-warm-accent-light flex items-center justify-center flex-shrink-0"><Eye className="h-3.5 w-3.5 text-warm-accent-foreground" /></div>
                  Things showing up in your records
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {categoryPatterns.slice(0, 5).map(({ category, count }) => (
                    <span key={category} className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-primary/8 text-primary border border-primary/15">
                      {category} ({count})
                    </span>
                  ))}
                </div>

                {concentratedPeriod && (
                  <p className="text-[14px] text-body leading-relaxed mb-3 flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-[7px]" />
                    {concentratedPeriod}
                  </p>
                )}

                {patterns.length > 0 && (
                  <div className="space-y-2.5 pt-3 border-t border-border/60">
                    {patterns.map((p, i) => (
                      <p key={i} className="text-[14px] text-body leading-relaxed flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-[7px]" />
                        {p}
                      </p>
                    ))}
                  </div>
                )}

                {aiSummaries.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <div className="mb-2"><AILabel /></div>
                    <div className="space-y-2.5">
                      {aiSummaries.map((s, i) => (
                        <p key={i} className="text-[14px] text-body leading-relaxed flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-ai-label/60 flex-shrink-0 mt-[7px]" />
                          {s}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : patterns.length > 0 ? (
                  <button
                    onClick={handleAiSummarise}
                    disabled={aiLoading}
                    className="mt-3 text-[13px] text-primary font-medium flex items-center gap-1.5"
                  >
                    {aiLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</> : 'Generate Summary'}
                  </button>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* When things are happening */}
          {chartData.length > 0 && (
            <AccordionItem value="timing" className="bg-card border border-border rounded-xl shadow-[var(--shadow-card)] overflow-hidden px-1">
              <AccordionTrigger className="px-3 py-4 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><TrendingUp className="h-3.5 w-3.5 text-secondary-foreground" /></div>
                  When things are happening
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={24} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {chartData.map((_, index) => (
                          <Cell key={index} fill="hsl(var(--primary))" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Gaps in your records */}
          {dataGaps.length > 0 && (
            <AccordionItem value="gaps" className="bg-card border border-border rounded-xl shadow-[var(--shadow-card)] overflow-hidden px-1">
              <AccordionTrigger className="px-3 py-4 text-[14px] font-medium text-foreground hover:no-underline gap-3">
                <span className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-warm-accent-light flex items-center justify-center flex-shrink-0"><Shield className="h-3.5 w-3.5 text-warm-accent-foreground" /></div>
                  Things you could add
                  <span className="text-[11px] text-muted-foreground font-normal">(optional)</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4">
                <div className="space-y-2">
                  {dataGaps.map((gap, i) => (
                    <button
                      key={i}
                      onClick={() => navigate(`/timeline?gap=${gap.filterKey}`)}
                      className="w-full flex items-start justify-between gap-2 text-left hover:bg-muted/40 rounded-xl p-3 -mx-1 transition-colors"
                    >
                      <div>
                        <p className="text-[14px] text-body">{gap.count} incident{gap.count > 1 ? 's' : ''} {gap.label}</p>
                        <p className="text-[12px] text-primary mt-1 flex items-center gap-1.5">
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
