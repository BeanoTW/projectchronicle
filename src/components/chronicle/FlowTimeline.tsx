import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays, isValid, subMonths, subWeeks } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { Incident } from '@/hooks/useIncidents';

/* ── Types ── */
interface Props {
  incidents: Incident[];
  repeatedPeople: Set<string>;
  totalIncidents: number;
  mostFrequentPerson: string | null;
}

interface Bucket {
  start: Date;
  end: Date;
  count: number;
  label: string;
}

/* ── Range presets ── */
type RangeKey = 'all' | '6m' | '1m' | '2w';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'Full range' },
  { key: '6m', label: '6 months' },
  { key: '1m', label: '1 month' },
  { key: '2w', label: '2 weeks' },
];

const RANGE_STORAGE_KEY = 'chronicle_activity_range';

/* ── Bucket builder ── */
function buildBuckets(sorted: Incident[], visMin: Date, visMax: Date): Bucket[] {
  const totalDays = differenceInDays(visMax, visMin) + 1;
  let bucketDays: number;
  if (totalDays <= 14) bucketDays = 1;
  else if (totalDays <= 60) bucketDays = 7;
  else if (totalDays <= 180) bucketDays = 14;
  else bucketDays = 30;

  const buckets: Bucket[] = [];
  let cursor = new Date(visMin);

  while (cursor <= visMax) {
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() + bucketDays - 1);
    if (bucketEnd > visMax) bucketEnd.setTime(visMax.getTime());

    const count = sorted.filter(inc => {
      const d = parseISO(inc.incident_date);
      return d >= cursor && d <= bucketEnd;
    }).length;

    let label: string;
    if (bucketDays <= 1) label = format(cursor, 'd MMM');
    else if (bucketDays <= 7) label = format(cursor, 'd MMM');
    else if (bucketDays <= 14) label = format(cursor, 'd MMM');
    else label = format(cursor, 'MMM yyyy');

    buckets.push({ start: new Date(cursor), end: new Date(bucketEnd), count, label });

    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + bucketDays);
  }

  return buckets;
}

/* ── Summary builder ── */
function buildSummary(incidents: Incident[], visMin: Date, visMax: Date): string {
  const visible = incidents.filter(inc => {
    const d = parseISO(inc.incident_date);
    return d >= visMin && d <= visMax;
  });

  if (visible.length === 0) return 'No incidents recorded in this period.';

  if (visible.length === 1) {
    const d = parseISO(visible[0].incident_date);
    return `1 incident recorded on ${format(d, 'd MMMM yyyy')}.`;
  }

  const dates = visible.map(i => parseISO(i.incident_date)).sort((a, b) => a.getTime() - b.getTime());
  const span = differenceInDays(dates[dates.length - 1], dates[0]);
  const startStr = format(dates[0], 'd MMMM yyyy');
  const endStr = format(dates[dates.length - 1], 'd MMMM yyyy');

  return `${visible.length} incidents recorded within ${span} days — ${startStr} to ${endStr}.`;
}

/* ── Label sampling for axis ── */
function sampleLabels(buckets: Bucket[], maxLabels: number): Set<number> {
  if (buckets.length <= maxLabels) return new Set(buckets.map((_, i) => i));
  const indices = new Set<number>();
  for (let k = 0; k < maxLabels; k++) {
    indices.add(Math.round((k / (maxLabels - 1)) * (buckets.length - 1)));
  }
  return indices;
}

/* ── Component ── */
const FlowTimeline = ({ incidents }: Props) => {
  const navigate = useNavigate();

  const [range, setRange] = useState<RangeKey>(() => {
    try {
      const stored = localStorage.getItem(RANGE_STORAGE_KEY);
      if (stored && RANGE_OPTIONS.some(r => r.key === stored)) return stored as RangeKey;
    } catch {}
    return 'all';
  });

  const handleRangeChange = useCallback((key: RangeKey) => {
    setRange(key);
    try { localStorage.setItem(RANGE_STORAGE_KEY, key); } catch {}
  }, []);

  // Sorted incidents
  const sorted = useMemo(() =>
    [...incidents]
      .filter(i => isValid(parseISO(i.incident_date)))
      .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime()),
    [incidents]
  );

  // Global date range
  const globalMin = useMemo(() => sorted.length > 0 ? parseISO(sorted[0].incident_date) : new Date(), [sorted]);
  const globalMax = useMemo(() => sorted.length > 0 ? parseISO(sorted[sorted.length - 1].incident_date) : new Date(), [sorted]);

  // Visible window
  const { visMin, visMax } = useMemo(() => {
    const max = globalMax;
    switch (range) {
      case '6m': return { visMin: subMonths(max, 6), visMax: max };
      case '1m': return { visMin: subMonths(max, 1), visMax: max };
      case '2w': return { visMin: subWeeks(max, 2), visMax: max };
      default: return { visMin: globalMin, visMax: max };
    }
  }, [range, globalMin, globalMax]);

  // Shared buckets
  const buckets = useMemo(() => buildBuckets(sorted, visMin, visMax), [sorted, visMin, visMax]);
  const maxCount = useMemo(() => Math.max(1, ...buckets.map(b => b.count)), [buckets]);

  // Chart data
  const chartData = useMemo(() => buckets.map(b => ({ label: b.label, count: b.count })), [buckets]);

  // Labels to show (max 5 on mobile)
  const visibleLabelIndices = useMemo(() => sampleLabels(buckets, 5), [buckets]);

  // Summary
  const summary = useMemo(() => buildSummary(sorted, visMin, visMax), [sorted, visMin, visMax]);

  // Visible incidents for card list
  const visibleIncidents = useMemo(() =>
    sorted.filter(inc => {
      const d = parseISO(inc.incident_date);
      return d >= visMin && d <= visMax;
    }),
    [sorted, visMin, visMax]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIncident = visibleIncidents.find(i => i.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex items-center gap-1.5">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleRangeChange(opt.key)}
            className={`text-[11px] px-3 py-1.5 rounded-full transition-all duration-200 ${
              range === opt.key
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground/50 hover:text-muted-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Density graph */}
      {chartData.length >= 2 ? (
        <div className="w-full h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval={0}
                tickFormatter={(value, index) => visibleLabelIndices.has(index) ? value : ''}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill="url(#activityFill)"
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="w-full h-[120px] flex items-center justify-center">
          <p className="text-[12px] text-muted-foreground/40">Not enough data for graph</p>
        </div>
      )}

      {/* Heat strip */}
      <div className="flex w-full h-[6px] rounded-full overflow-hidden gap-[1px]">
        {buckets.map((b, i) => {
          const opacity = b.count === 0 ? 0.05 : 0.15 + (b.count / maxCount) * 0.75;
          return (
            <div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                backgroundColor: `hsl(var(--primary) / ${opacity})`,
              }}
            />
          );
        })}
      </div>

      {/* Summary */}
      <p className="text-[13px] text-muted-foreground leading-relaxed">{summary}</p>

      {/* Incident list for visible period */}
      {visibleIncidents.length > 0 && (
        <div className="space-y-1.5">
          {visibleIncidents.slice(0, 10).map(inc => {
            const isSelected = selectedId === inc.id;
            return (
              <button
                key={inc.id}
                onClick={() => setSelectedId(prev => prev === inc.id ? null : inc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                  isSelected
                    ? 'bg-primary/[0.06] border-primary/20'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground/50 block">
                      {format(parseISO(inc.incident_date), 'd MMM yyyy')}
                    </span>
                    <p className="text-[13px] font-medium text-foreground leading-snug truncate">
                      {displayTitle(inc)}
                    </p>
                  </div>
                  {isSelected && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/incident/${inc.id}`); }}
                      className="text-[11px] text-primary font-medium whitespace-nowrap flex-shrink-0"
                    >
                      Open →
                    </motion.button>
                  )}
                </div>
              </button>
            );
          })}
          {visibleIncidents.length > 10 && (
            <p className="text-[11px] text-muted-foreground/40 text-center pt-1">
              +{visibleIncidents.length - 10} more in this period
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FlowTimeline;
