import { useMemo, useState } from 'react';
import { BarChart3, FileText, Users, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
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

  const patterns = useMemo(() => {
    const result: string[] = [];
    const peopleCounts: Record<string, number> = {};
    incidents.forEach(i => i.people_involved.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; }));
    Object.entries(peopleCounts).filter(([, c]) => c >= 2).forEach(([name, count]) => {
      result.push(`Repeated interaction with the same individual — ${name} (${count} incidents). This may indicate an ongoing issue rather than isolated events.`);
    });
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCat && topCat[1] >= 3) result.push(`The majority of recorded incidents involve ${topCat[0].toLowerCase()} (${topCat[1]} incidents), which may suggest a recurring concern in this area.`);
    const sortedDates = incidents.map(i => new Date(i.incident_date).getTime()).sort();
    for (let i = 0; i < sortedDates.length - 2; i++) {
      if (sortedDates[i + 2] - sortedDates[i] <= 7 * 86400000) {
        result.push('Multiple incidents occurred within a concentrated timeframe, which may reflect an escalation rather than coincidence.');
        break;
      }
    }
    return result;
  }, [incidents]);

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
    const months: Record<string, { name: string; count: number; severity: string }> = {};
    incidents.forEach(i => {
      const d = new Date(i.incident_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleString('default', { month: 'short' });
      if (!months[key]) months[key] = { name, count: 0, severity: 'Low' };
      months[key].count++;
      if (i.severity === 'Critical' || i.severity === 'Serious') months[key].severity = i.severity!;
    });
    return Object.values(months);
  }, [incidents]);

  const severityColors: Record<string, string> = {
    Critical: 'hsl(0, 72%, 35%)',
    Serious: 'hsl(32, 88%, 37%)',
    Moderate: 'hsl(28, 82%, 31%)',
    Low: 'hsl(160, 87%, 20%)',
  };

  const strengthPrompts = useMemo(() => {
    const result: string[] = [];
    const noEvidence = incidents.filter(i => !allEvidence.some(e => e.incident_id === i.id)).length;
    if (noEvidence > 0) result.push(`${noEvidence} incident${noEvidence > 1 ? 's have' : ' has'} no evidence attached. Linking evidence strengthens your records.`);
    const noWitness = incidents.filter(i => i.witnesses.length === 0 && i.people_involved.length <= 1).length;
    if (noWitness > 0) result.push(`Adding names of people present can strengthen the timeline of events.`);
    return result;
  }, [incidents, allEvidence]);

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

      {patterns.length > 0 && (
        <div className="mx-4 mb-4 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Pattern Analysis</h2>
          <div className="space-y-2">
            {patterns.slice(0, 5).map((p, i) => (
              <p key={i} className="text-xs text-body leading-relaxed">• {p}</p>
            ))}
          </div>

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

      <div className="mx-4 mb-4 bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Incident Activity</h2>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={20} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={severityColors[entry.severity] || severityColors.Low} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {strengthPrompts.length > 0 && (
        <div className="mx-4 mb-4 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Ways to strengthen your records</h2>
          <div className="space-y-1.5">
            {strengthPrompts.map((p, i) => (
              <p key={i} className="text-xs text-body">• {p}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsScreen;
