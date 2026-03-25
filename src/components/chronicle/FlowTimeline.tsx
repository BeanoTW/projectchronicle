import { useRef, useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';
import FlowFrequencyChart from './FlowFrequencyChart';
import { deriveEscalationSignal } from '@/lib/flowEscalation';

const categoryColors: Record<string, string> = {
  'Management Conduct': 'hsl(var(--primary))',
  'Verbal Comment': 'hsl(var(--warm-accent))',
  'Safety Concern': 'hsl(var(--severity-serious))',
  'Written Communication': 'hsl(var(--info))',
  'Scheduling or Shift Change': 'hsl(var(--muted-foreground))',
  'Disciplinary Meeting': 'hsl(var(--destructive))',
  'Pay or Payroll Issue': 'hsl(var(--warm-accent))',
  'Policy Application': 'hsl(var(--info))',
  'Workplace Meeting': 'hsl(var(--primary))',
  'Academic Misconduct': 'hsl(var(--destructive))',
  'Accommodation Issue': 'hsl(var(--warm-accent))',
  'Teaching or Supervision': 'hsl(var(--primary))',
  'Noise Complaint': 'hsl(var(--severity-serious))',
  'Property Damage': 'hsl(var(--destructive))',
  'Shared Space Dispute': 'hsl(var(--warm-accent))',
  'Antisocial Behaviour': 'hsl(var(--severity-serious))',
  'Public Safety': 'hsl(var(--destructive))',
  'Transport Incident': 'hsl(var(--info))',
  'Other': 'hsl(var(--muted-foreground))',
};

interface Props {
  incidents: Incident[];
  repeatedPeople: Set<string>;
  totalIncidents: number;
  mostFrequentPerson: string | null;
}

/* ── Signal derivation ── */

interface FlowSignal {
  key: string;
  text: string;
  type: 'neutral' | 'escalation' | 'pause';
}

function deriveSignals(
  sorted: Incident[],       // ASC by date, valid dates only
  gaps: number[],           // consecutive day gaps (sorted[i] → sorted[i+1])
): FlowSignal[] {
  const signals: FlowSignal[] = [];
  if (sorted.length < 2) return signals;

  // 1. Frequency trend – compare recent vs earlier gaps
  if (gaps.length >= 4) {
    const len = gaps.length;
    const recentAvg = (gaps[len - 1] + gaps[len - 2]) / 2;
    const earlierAvg = (gaps[len - 3] + gaps[len - 4]) / 2;
    if (earlierAvg > 0 && recentAvg <= earlierAvg * 0.75) {
      signals.push({ key: 'trend', text: 'Activity increasing', type: 'escalation' });
    } else if (recentAvg > 0 && recentAvg >= earlierAvg * 1.25 && earlierAvg > 0) {
      signals.push({ key: 'trend', text: 'Activity decreasing', type: 'neutral' });
    }
  }

  // 2. Cluster detection – 2+ incidents within 14 days
  let bestClusterCount = 0;
  let bestClusterSpan = 0;
  let clusterStart = 0;
  for (let i = 1; i < sorted.length; i++) {
    const spanFromStart = differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[clusterStart].incident_date));
    if (spanFromStart <= 14) {
      const count = i - clusterStart + 1;
      if (count > bestClusterCount) {
        bestClusterCount = count;
        bestClusterSpan = spanFromStart;
      }
    } else {
      clusterStart = i;
    }
  }
  if (bestClusterCount >= 3) {
    signals.push({
      key: 'cluster',
      text: `${bestClusterCount} incidents occurred within ${bestClusterSpan || 1} days`,
      type: 'escalation',
    });
  } else if (bestClusterCount === 2 && bestClusterSpan <= 7) {
    signals.push({
      key: 'cluster',
      text: 'Some incidents happened close together in time',
      type: 'neutral',
    });
  }

  // 3. Long pause detection – any consecutive gap ≥ 21 days
  const longestGap = Math.max(...gaps);
  if (longestGap >= 21) {
    // Check if the long pause is followed by recent activity
    const lastGapIdx = gaps.lastIndexOf(longestGap);
    const isFollowedByRecent = lastGapIdx < gaps.length - 1;
    if (isFollowedByRecent) {
      signals.push({ key: 'pause', text: 'Long pause followed by recent activity', type: 'pause' });
    } else {
      signals.push({ key: 'pause', text: 'Long pause between records', type: 'pause' });
    }
  }

  // Cap at 3 signals
  return signals.slice(0, 3);
}

const FlowTimeline = ({ incidents, repeatedPeople, totalIncidents, mostFrequentPerson }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter valid dates, sort oldest-first (ASC)
  const sorted = useMemo(() =>
    [...incidents]
      .filter(i => isValid(parseISO(i.incident_date)))
      .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime()),
    [incidents]
  );

  // Parsed dates for chart + escalation
  const sortedDates = useMemo(() => sorted.map(i => parseISO(i.incident_date)), [sorted]);

  // Consecutive gaps
  const consecutiveGaps = useMemo(() => {
    const g: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      g.push(differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i - 1].incident_date)));
    }
    return g;
  }, [sorted]);

  // Interpreted signals (max 3)
  const signals = useMemo(() => deriveSignals(sorted, consecutiveGaps), [sorted, consecutiveGaps]);

  // Single escalation signal
  const escalation = useMemo(() => deriveEscalationSignal(sorted, sortedDates), [sorted, sortedDates]);

  // Check if chart should render (≥3 records spanning multiple days)
  const showChart = useMemo(() => {
    if (sortedDates.length < 3) return false;
    const span = differenceInDays(sortedDates[sortedDates.length - 1], sortedDates[0]);
    return span >= 2;
  }, [sortedDates]);

  // Dot visual data – spacing reflects real time, NO gap labels
  const dotData = useMemo(() => {
    if (sorted.length === 0) return [];
    const minSpacing = 6;
    const maxSpacing = 48;

    return sorted.map((inc, i) => {
      const gap = i > 0
        ? differenceInDays(parseISO(inc.incident_date), parseISO(sorted[i - 1].incident_date))
        : 0;

      const spacing = i === 0 ? 0 : Math.max(minSpacing, Math.min(maxSpacing, minSpacing + (gap / 30) * (maxSpacing - minSpacing)));
      const isCluster = gap <= 3 && i > 0;
      const hasRing = inc.people_involved.some(p => repeatedPeople.has(p));
      const color = categoryColors[inc.category || ''] || 'hsl(var(--muted-foreground))';
      // Recent records slightly larger
      const recencyBoost = i >= sorted.length - 2 ? 2 : 0;
      const baseSize = (isCluster ? 14 : 10) + recencyBoost;

      return { inc, gap, spacing, isCluster, hasRing, color, baseSize };
    });
  }, [sorted, repeatedPeople]);

  // Month markers
  const monthMarkers = useMemo(() => {
    const markers: { index: number; label: string }[] = [];
    let currentMonth = '';
    sorted.forEach((inc, i) => {
      const m = format(parseISO(inc.incident_date), 'MMM yy');
      if (m !== currentMonth) {
        markers.push({ index: i, label: m });
        currentMonth = m;
      }
    });
    return markers;
  }, [sorted]);

  const selectedIncident = sorted.find(i => i.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Interpreted signals – max 3 */}
      {signals.length > 0 && (
        <div className="space-y-1.5 px-1">
          {signals.map(s => (
            <div
              key={s.key}
              className={`text-[12px] leading-snug font-medium ${
                s.type === 'escalation'
                  ? 'text-primary'
                  : s.type === 'pause'
                    ? 'text-muted-foreground'
                    : 'text-foreground/70'
              }`}
            >
              {s.text}
            </div>
          ))}
        </div>
      )}

      {/* Fallback if no signals */}
      {signals.length === 0 && sorted.length >= 2 && (
        <p className="text-[12px] text-muted-foreground/60 px-1">
          Activity spread out over time — no strong patterns detected
        </p>
      )}

      {/* Horizontal dot timeline – visual only, no gap labels */}
      <div ref={scrollRef} className="overflow-x-auto scrollbar-hide -mx-5 px-5">
        <div className="flex items-end min-w-max pb-6 pt-6 relative">
          {/* Baseline */}
          <div className="absolute bottom-[22px] left-0 right-0 h-[1.5px] bg-border" />

          {dotData.map((d, i) => {
            const isSelected = selectedId === d.inc.id;
            const monthMarker = monthMarkers.find(m => m.index === i);

            return (
              <div key={d.inc.id} className="relative flex flex-col items-center" style={{ marginLeft: d.spacing }}>
                <button
                  onClick={() => setSelectedId(isSelected ? null : d.inc.id)}
                  className="relative z-10"
                >
                  <div
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: isSelected ? d.baseSize * 1.3 : d.baseSize,
                      height: isSelected ? d.baseSize * 1.3 : d.baseSize,
                      backgroundColor: d.color,
                      boxShadow: isSelected
                        ? `0 0 0 3px hsl(var(--background)), 0 0 0 5px ${d.color}`
                        : d.hasRing
                          ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${d.color}`
                          : 'none',
                      marginBottom: `${22 - (isSelected ? d.baseSize * 1.3 : d.baseSize) / 2}px`,
                    }}
                  />
                </button>

                {/* Month label */}
                {monthMarker && (
                  <span className="absolute -bottom-4 text-[9px] text-muted-foreground/50 whitespace-nowrap">
                    {monthMarker.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Minimal legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" /> Grouped
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-current" style={{ boxShadow: '0 0 0 1.5px currentColor' }} /> Repeated person
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" /> Spaced
        </span>
      </div>

      {/* Escalation signal – single, prioritised */}
      {escalation && (
        <div className="px-1 mt-1">
          <p className="text-[12px] font-medium text-primary leading-snug">
            {escalation.headline}
          </p>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            {escalation.explanation}
          </p>
        </div>
      )}

      {/* Frequency chart */}
      {showChart && <FlowFrequencyChart dates={sortedDates} />}

      {/* Selected record preview */}
      <AnimatePresence>
        {selectedIncident && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border rounded-xl px-4 py-3 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground/60 block">
                  {format(parseISO(selectedIncident.incident_date), 'dd MMM yyyy')}
                  {selectedIncident.incident_time && ` · ${selectedIncident.incident_time}`}
                </span>
                <p className="text-[13px] font-semibold text-foreground leading-snug mt-0.5 truncate">
                  {selectedIncident.title || 'Untitled'}
                </p>
                {selectedIncident.people_involved.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
                    {selectedIncident.people_involved.join(', ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate(`/incident/${selectedIncident.id}`)}
                className="text-[11px] text-primary font-medium whitespace-nowrap flex-shrink-0 mt-1"
              >
                Open →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlowTimeline;
