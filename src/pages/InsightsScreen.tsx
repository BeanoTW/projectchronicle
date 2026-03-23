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
        <div className="px-5 pt-8"><h1 className="text-lg font-bold text-foreground tracking-tight">Insights</h1></div>
        <EmptyState
          icon={<BarChart3 className="h-10 w-10" />}
          heading="Not enough data yet"
          body="Record more incidents to see what's showing up in your records."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-lg font-bold text-foreground tracking-tight">Insights</h1>
        <p className="text-[13px] text-muted-foreground mt-1">A summary of what you've recorded so far.</p>
      </div>

      {/* Overview — structured findings */}
      <div className="px-5 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] space-y-2.5">
          <div className="flex items-center gap-2 text-[14px]">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground"><span className="font-semibold">{totalIncidents}</span> incidents recorded</span>
          </div>
          <div className="flex items-center gap-2 text-[14px]">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground"><span className="font-semibold">{withEvidence}</span> include evidence</span>
          </div>
          <div className="flex items-center gap-2 text-[14px]">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground"><span className="font-semibold">{withWitnesses}</span> include witnesses</span>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* People involved */}
        {keyIndividuals.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              People involved
            </h2>
            <div className="space-y-2.5">
              {keyIndividuals.map(({ name, count, firstDate, lastDate }) => (
                <p key={name} className="text-[14px] text-body leading-relaxed">
                  <span className="font-medium">{name}</span> — {count} incidents ({format(parseISO(firstDate), 'MMM yyyy')} to {format(parseISO(lastDate), 'MMM yyyy')})
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Patterns */}
        {categoryPatterns.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Things showing up in your records
            </h2>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {categoryPatterns.slice(0, 5).map(({ category, count }) => (
                <span key={category} className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-primary/6 text-primary border border-primary/12">
                  {category} ({count})
                </span>
              ))}
            </div>

            {concentratedPeriod && (
              <p className="text-[14px] text-body leading-relaxed mb-3">{concentratedPeriod}</p>
            )}

            {patterns.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border">
                {patterns.map((p, i) => (
                  <p key={i} className="text-[14px] text-body leading-relaxed">{p}</p>
                ))}
              </div>
            )}

            {aiSummaries.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="mb-2"><AILabel /></div>
                <div className="space-y-2">
                  {aiSummaries.map((s, i) => (
                    <p key={i} className="text-[14px] text-body leading-relaxed">{s}</p>
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
          </div>
        )}

        {/* When things are happening */}
        {chartData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              When things are happening
            </h2>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={20} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={index} fill="hsl(var(--primary))" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Gaps */}
        {dataGaps.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Things you could add
              <span className="text-[11px] text-muted-foreground font-normal">(optional)</span>
            </h2>
            <div className="space-y-2">
              {dataGaps.map((gap, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/timeline?gap=${gap.filterKey}`)}
                  className="w-full flex items-start justify-between gap-2 text-left hover:bg-muted/40 rounded-lg p-2.5 -mx-1 transition-colors"
                >
                  <div>
                    <p className="text-[14px] text-body">{gap.count} incident{gap.count > 1 ? 's' : ''} {gap.label}</p>
                    <p className="text-[12px] text-primary mt-0.5 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" /> {gap.action}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsScreen;
