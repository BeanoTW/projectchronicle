import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Counts = Record<string, number>;
type Stats = {
  totals: Counts;
  active7: number;
  active30: number;
  topScreens: Array<[string, number]>;
  loading: boolean;
  error: string | null;
};

const TRACKED_EVENTS = [
  'account_created',
  'login_completed',
  'first_record_created',
  'record_completed',
  'daily_record_created',
  'export_generated',
  'export_downloaded',
  'export_shared',
  'export_printed',
  'return_session',
  'consecutive_day_usage',
  'timeline_viewed',
  'calendar_viewed',
  'my_record_viewed',
  'export_builder_opened',
];

const SCREEN_EVENTS = ['timeline_viewed', 'calendar_viewed', 'my_record_viewed', 'export_builder_opened'];

const DevAnalyticsPanel = () => {
  const [stats, setStats] = useState<Stats>({
    totals: {}, active7: 0, active30: 0, topScreens: [], loading: true, error: null,
  });

  const load = async () => {
    setStats(s => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_name, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) throw error;
      const rows = data ?? [];
      const totals: Counts = {};
      const users7 = new Set<string>();
      const users30 = new Set<string>();
      const screenCounts: Counts = {};
      const now = Date.now();
      const d7 = now - 7 * 86400_000;
      const d30 = now - 30 * 86400_000;
      for (const r of rows) {
        const name = r.event_name as string;
        totals[name] = (totals[name] ?? 0) + 1;
        const t = r.created_at ? Date.parse(r.created_at as string) : 0;
        if (r.user_id) {
          if (t >= d30) users30.add(r.user_id as string);
          if (t >= d7) users7.add(r.user_id as string);
        }
        if (SCREEN_EVENTS.includes(name)) {
          screenCounts[name] = (screenCounts[name] ?? 0) + 1;
        }
      }
      const topScreens = Object.entries(screenCounts).sort((a, b) => b[1] - a[1]);
      setStats({ totals, active7: users7.size, active30: users30.size, topScreens, loading: false, error: null });
    } catch (e) {
      setStats(s => ({ ...s, loading: false, error: (e as Error).message }));
    }
  };

  useEffect(() => { void load(); }, []);

  const Row = ({ label, value }: { label: string; value: number | string }) => (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </div>
  );

  if (stats.loading) return <p className="text-muted-foreground">Loading analytics…</p>;
  if (stats.error) return <p className="text-destructive">Error: {stats.error}</p>;

  const t = stats.totals;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-foreground">Internal Analytics</p>
        <button onClick={load} className="text-[10px] text-primary underline">Refresh</button>
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase text-muted-foreground mt-1">Activation</p>
        <Row label="Accounts created" value={t.account_created ?? 0} />
        <Row label="Logins" value={t.login_completed ?? 0} />
        <Row label="First record created" value={t.first_record_created ?? 0} />
        <Row label="Records completed" value={t.record_completed ?? 0} />
        <Row label="Daily records" value={t.daily_record_created ?? 0} />

        <p className="text-[10px] uppercase text-muted-foreground mt-2">Exports</p>
        <Row label="Generated" value={t.export_generated ?? 0} />
        <Row label="Downloaded" value={t.export_downloaded ?? 0} />
        <Row label="Shared" value={t.export_shared ?? 0} />
        <Row label="Printed" value={t.export_printed ?? 0} />

        <p className="text-[10px] uppercase text-muted-foreground mt-2">Retention</p>
        <Row label="Active users (7d)" value={stats.active7} />
        <Row label="Active users (30d)" value={stats.active30} />
        <Row label="Returning sessions" value={t.return_session ?? 0} />
        <Row label="Consecutive day usage" value={t.consecutive_day_usage ?? 0} />

        <p className="text-[10px] uppercase text-muted-foreground mt-2">Most-used sections</p>
        {stats.topScreens.length === 0 && (
          <p className="text-muted-foreground">No screen views recorded yet.</p>
        )}
        {stats.topScreens.map(([name, count]) => (
          <Row key={name} label={name.replace(/_/g, ' ')} value={count} />
        ))}
      </div>
    </div>
  );
};

export default DevAnalyticsPanel;
