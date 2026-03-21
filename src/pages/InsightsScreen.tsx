import { useMemo, useState } from 'react';
import { BarChart3, FileText, Users, AlertTriangle, TrendingUp, Loader2, Shield, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import EmptyState from '@/components/chronicle/EmptyState';
import AILabel from '@/components/chronicle/AILabel';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const InsightsScreen = () => {
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();
  const { toast } = useToast();
  const [aiSummaries, setAiSummaries] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const totalIncidents = incidents.length;
  const thisMonth = incidents.filter(i => new Date(i.incident_date).getMonth() === new Date().getMonth()).length;
  const withEvidence = incidents.filter(i => allEvidence.some(e => e.incident_id === i.id)).length;
  const openIncidents = incidents.filter(i => i.status === 'Open').length;
  const withWitnesses = incidents.filter(i => i.witnesses.length > 0).length;

  // Key individuals with date ranges
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

  // Category pattern recognition
  const categoryPatterns = useMemo(() => {
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    return Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }, [incidents]);

  // Concentrated periods
  const concentratedPeriod = useMemo(() => {
    if (incidents.length < 3) return null;
    const sortedDates = incidents.map(i => new Date(i.incident_date).getTime()).sort();
    for (let i = 0; i < sortedDates.length - 2; i++) {
      if (sortedDates[i + 2] - sortedDates[i] <= 7 * 86400000) {
        return '3 or more incidents recorded within a 7-day period';
      }
    }
    return null;
  }, [incidents]);

  // Data gaps with action prompts
  const dataGaps = useMemo(() => {
    const gaps: { label: string; count: number; action: string }[] = [];
    const noEvidence = incidents.filter(i => !allEvidence.some(e => e.incident_id === i.id)).length;
    if (noEvidence > 0) gaps.push({ label: 'Missing evidence', count: noEvidence, action: 'Add evidence to strengthen records' });
    const noWitness = incidents.filter(i => i.witnesses.length === 0).length;
    if (noWitness > 0) gaps.push({ label: 'Missing witnesses', count: noWitness, action: 'Consider adding witnesses' });
    const noExactWords = incidents.filter(i => !i.exact_words).length;
    if (noExactWords > 0) gaps.push({ label: 'Missing exact wording', count: noExactWords, action: 'Add exact wording if remembered' });
    const noImpact = incidents.filter(i => !i.impact_note).length;
    if (noImpact > 0) gaps.push({ label: 'Missing impact notes', count: noImpact, action: 'Add impact details if relevant' });
    return gaps;
  }, [incidents, allEvidence]);

  // Factual patterns for AI summarisation input
  const patterns = useMemo(() => {
    const result: string[] = [];
    keyIndividuals.forEach(({ name, count, firstDate, lastDate }) => {
      result.push(`${name} appears in ${count} recorded incidents between ${format(parseISO(firstDate), 'MMMM yyyy')} and ${format(parseISO(lastDate), 'MMMM yyyy')}.`);
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
      toast({ title: 'AI summary failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
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
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (incidents.length < 2) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="px-4 pt-6"><h1 className="text-2xl font-bold text-foreground">Insights</h1></div>
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          heading="Not enough data yet"
          body="Record more incidents to unlock pattern insights and timeline analysis."
        />
      </div>
    );
  }

  const overviewCards = [
    { label: 'Total Incidents', value: totalIncidents, icon: FileText },
    { label: 'This Month', value: thisMonth, icon: TrendingUp },
    { label: 'With Evidence', value: withEvidence, icon: FileText },
    { label: 'Open', value: openIncidents, icon: AlertTriangle },
    { label: 'With Witnesses', value: withWitnesses, icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Insights</h1>
        <p className="text-xs text-muted-foreground mt-1">Data observations from your recorded incidents. Not legal advice.</p>
      </div>

      <div className="px-4 grid grid-cols-3 gap-2 mb-4">
        {overviewCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3 text-center">
            <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Emerging Patterns */}
      {(keyIndividuals.length > 0 || categoryPatterns.length > 0 || concentratedPeriod) && (
        <div className="mx-4 mb-4 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Emerging Patterns in Your Records
          </h2>

          {/* Key Individuals */}
          {keyIndividuals.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Key Individuals</p>
              <div className="space-y-1">
                {keyIndividuals.map(({ name, count, firstDate, lastDate }) => (
                  <p key={name} className="text-xs text-body">
                    <span className="font-medium">{name}</span> — {count} incidents ({format(parseISO(firstDate), 'MMM yyyy')} to {format(parseISO(lastDate), 'MMM yyyy')})
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Most Common Types */}
          {categoryPatterns.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Most Common Incident Types</p>
              <div className="flex flex-wrap gap-1.5">
                {categoryPatterns.slice(0, 4).map(({ category, count }) => (
                  <span key={category} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                    {category} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Concentrated Period */}
          {concentratedPeriod && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Activity Concentration</p>
              <p className="text-xs text-body">{concentratedPeriod}</p>
            </div>
          )}

          {/* Factual Observations */}
          {patterns.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              {patterns.map((p, i) => (
                <p key={i} className="text-xs text-body leading-relaxed">• {p}</p>
              ))}
            </div>
          )}

          {aiSummaries.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="mb-2"><AILabel /></div>
              <div className="space-y-2">
                {aiSummaries.map((s, i) => (
                  <p key={i} className="text-xs text-body leading-relaxed">• {s}</p>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={handleAiSummarise}
              disabled={aiLoading}
              className="mt-3 text-xs text-primary font-medium flex items-center gap-1"
            >
              {aiLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Summarising...</> : 'Summarise with AI'}
            </button>
          )}
        </div>
      )}

      {/* Data Gaps with Action Prompts */}
      {dataGaps.length > 0 && (
        <div className="mx-4 mb-4 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-severity-serious" />
            Data Gaps
          </h2>
          <div className="space-y-2">
            {dataGaps.map((gap, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-body">{gap.count} incident{gap.count > 1 ? 's' : ''} {gap.label.toLowerCase()}</p>
                  <p className="text-[11px] text-primary">→ {gap.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-4 mb-4 bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Incident Activity</h2>
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
    </div>
  );
};

export default InsightsScreen;
