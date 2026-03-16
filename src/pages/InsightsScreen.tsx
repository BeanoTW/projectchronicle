import { useMemo } from 'react';
import { BarChart3, FileText, Users, MapPin, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { mockIncidents, mockEvidence, mockFollowUpNotes } from '@/data/mockData';
import EmptyState from '@/components/chronicle/EmptyState';

const InsightsScreen = () => {
  const incidents = mockIncidents;

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

  // Overview cards
  const totalIncidents = incidents.length;
  const thisMonth = incidents.filter(i => new Date(i.incident_date).getMonth() === new Date().getMonth()).length;
  const withEvidence = incidents.filter(i => mockEvidence.some(e => e.incident_id === i.incident_id)).length;
  const openIncidents = incidents.filter(i => i.status === 'Open').length;
  const withNotes = incidents.filter(i => mockFollowUpNotes.some(n => n.incident_id === i.incident_id)).length;
  const withWitnesses = incidents.filter(i => i.witnesses.length > 0).length;

  // Pattern detection
  const patterns: string[] = [];

  // Repeated people
  const peopleCounts: Record<string, number> = {};
  incidents.forEach(i => i.people_involved.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; }));
  Object.entries(peopleCounts).filter(([, c]) => c >= 2).forEach(([name, count]) => {
    patterns.push(`The same person appears in ${count} recorded incidents.`);
  });

  // Repeated categories
  const catCounts: Record<string, number> = {};
  incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] >= 3) {
    patterns.push(`Most recorded incidents relate to ${topCat[0]}.`);
  }

  // Time clusters
  const sortedDates = incidents.map(i => new Date(i.incident_date).getTime()).sort();
  for (let i = 0; i < sortedDates.length - 2; i++) {
    if (sortedDates[i + 2] - sortedDates[i] <= 7 * 86400000) {
      patterns.push('Several incidents were recorded within a short period.');
      break;
    }
  }

  // Chart data
  const chartData = useMemo(() => {
    const months: Record<string, { name: string; count: number; severity: string }> = {};
    incidents.forEach(i => {
      const d = new Date(i.incident_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleString('default', { month: 'short' });
      if (!months[key]) months[key] = { name, count: 0, severity: 'Low' };
      months[key].count++;
      if (i.severity === 'Critical' || i.severity === 'Serious') months[key].severity = i.severity;
    });
    return Object.values(months);
  }, [incidents]);

  const severityColors: Record<string, string> = {
    Critical: 'hsl(0, 72%, 35%)',
    Serious: 'hsl(32, 88%, 37%)',
    Moderate: 'hsl(28, 82%, 31%)',
    Low: 'hsl(160, 87%, 20%)',
  };

  // Strength indicators
  const strengthPrompts: string[] = [];
  const noEvidence = incidents.filter(i => !mockEvidence.some(e => e.incident_id === i.incident_id)).length;
  if (noEvidence > 0) strengthPrompts.push(`${noEvidence} incidents have no evidence attached.`);
  const noWitness = incidents.filter(i => i.witnesses.length === 0).length;
  if (noWitness > 0) strengthPrompts.push(`Adding witnesses can strengthen the timeline of events.`);
  const noNotes = incidents.filter(i => !mockFollowUpNotes.some(n => n.incident_id === i.incident_id)).length;
  if (noNotes > 0) strengthPrompts.push(`Consider adding follow-up notes after meetings.`);

  const overviewCards = [
    { label: 'Total Incidents', value: totalIncidents, icon: FileText },
    { label: 'This Month', value: thisMonth, icon: TrendingUp },
    { label: 'With Evidence', value: withEvidence, icon: FileText },
    { label: 'Open', value: openIncidents, icon: AlertTriangle },
    { label: 'With Notes', value: withNotes, icon: FileText },
    { label: 'With Witnesses', value: withWitnesses, icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Insights</h1>
        <p className="text-xs text-muted-foreground mt-1">Data observations from your recorded incidents. Not legal advice.</p>
      </div>

      {/* Overview Cards */}
      <div className="px-4 grid grid-cols-3 gap-2 mb-4">
        {overviewCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3 text-center">
            <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Pattern Summary */}
      {patterns.length > 0 && (
        <div className="mx-4 mb-4 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Pattern Summary</h2>
          <div className="space-y-1.5">
            {patterns.slice(0, 5).map((p, i) => (
              <p key={i} className="text-xs text-body">• {p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Activity Chart */}
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

      {/* Evidence Strength */}
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
