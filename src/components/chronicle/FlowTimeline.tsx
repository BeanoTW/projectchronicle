import { useRef, useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';

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

const FlowTimeline = ({ incidents, repeatedPeople, totalIncidents, mostFrequentPerson }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter valid dates, sort oldest-first
  const sorted = useMemo(() =>
    [...incidents]
      .filter(i => isValid(parseISO(i.incident_date)))
      .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime()),
    [incidents]
  );

  // Consecutive gaps for trend calculation
  const consecutiveGaps = useMemo(() => {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i - 1].incident_date)));
    }
    return gaps;
  }, [sorted]);

  // Frequency trend (same logic as Insights for consistency)
  const frequencyTrend = useMemo(() => {
    if (consecutiveGaps.length < 4) return null;
    const len = consecutiveGaps.length;
    // Recent = last 2 gaps, earlier = 2 before that
    const recentAvg = (consecutiveGaps[len - 1] + consecutiveGaps[len - 2]) / 2;
    const earlierAvg = (consecutiveGaps[len - 3] + consecutiveGaps[len - 4]) / 2;
    if (earlierAvg > 0 && recentAvg <= earlierAvg * 0.75) return 'Activity increasing';
    if (recentAvg > 0 && recentAvg >= earlierAvg * 1.25 && earlierAvg > 0) return 'Activity slowing';
    return null;
  }, [consecutiveGaps]);

  // Compute spacing that reflects real time intervals
  const dotData = useMemo(() => {
    if (sorted.length === 0) return [];
    const minSpacing = 6;
    const maxSpacing = 48;

    return sorted.map((inc, i) => {
      const gap = i > 0
        ? differenceInDays(parseISO(inc.incident_date), parseISO(sorted[i - 1].incident_date))
        : 0;

      // Proportional spacing: 0 days = minSpacing, 30+ days = maxSpacing
      const spacing = i === 0 ? 0 : Math.max(minSpacing, Math.min(maxSpacing, minSpacing + (gap / 30) * (maxSpacing - minSpacing)));

      const isCluster = gap <= 2 && i > 0;
      const hasRing = inc.people_involved.some(p => repeatedPeople.has(p));
      const color = categoryColors[inc.category || ''] || 'hsl(var(--muted-foreground))';
      const baseSize = isCluster ? 14 : 10;

      return { inc, gap, spacing, isCluster, hasRing, color, baseSize };
    });
  }, [sorted, repeatedPeople]);

  // Identify significant gaps for labels
  const gapLabels = useMemo(() => {
    if (consecutiveGaps.length === 0) return new Map<number, string>();
    const avg = consecutiveGaps.reduce((a, b) => a + b, 0) / consecutiveGaps.length;
    const labels = new Map<number, string>();
    consecutiveGaps.forEach((gap, i) => {
      if (gap >= 14 && gap >= avg * 1.5) {
        labels.set(i + 1, `${gap}-day gap`);
      }
    });
    // Same-day clusters
    let clusterStart = -1;
    let clusterCount = 0;
    consecutiveGaps.forEach((gap, i) => {
      if (gap <= 2) {
        if (clusterStart === -1) { clusterStart = i; clusterCount = 2; }
        else clusterCount++;
      } else {
        if (clusterCount >= 3) {
          const span = differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[clusterStart].incident_date));
          labels.set(clusterStart, `${clusterCount} in ${span || 1} days`);
        }
        clusterStart = -1;
        clusterCount = 0;
      }
    });
    if (clusterCount >= 3) {
      const span = differenceInDays(parseISO(sorted[sorted.length - 1].incident_date), parseISO(sorted[clusterStart!].incident_date));
      labels.set(clusterStart!, `${clusterCount} in ${span || 1} days`);
    }
    return labels;
  }, [consecutiveGaps, sorted]);

  const selectedIncident = sorted.find(i => i.id === selectedId);

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

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-center gap-4 px-1 text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{totalIncidents} recorded</span>
        {mostFrequentPerson && (
          <>
            <span className="opacity-30">·</span>
            <span>{mostFrequentPerson} appears most</span>
          </>
        )}
        {frequencyTrend && (
          <>
            <span className="opacity-30">·</span>
            <span className="text-primary font-medium">{frequencyTrend}</span>
          </>
        )}
      </div>

      {/* Horizontal scrollable flow */}
      <div ref={scrollRef} className="overflow-x-auto scrollbar-hide -mx-5 px-5">
        <div className="flex items-end min-w-max pb-6 pt-10 relative">
          {/* Baseline */}
          <div className="absolute bottom-[22px] left-0 right-0 h-[1.5px] bg-border" />

          {dotData.map((d, i) => {
            const isSelected = selectedId === d.inc.id;
            const gapLabel = gapLabels.get(i);
            const monthMarker = monthMarkers.find(m => m.index === i);

            return (
              <div key={d.inc.id} className="relative flex flex-col items-center" style={{ marginLeft: d.spacing }}>
                {/* Gap label */}
                {gapLabel && (
                  <span className="absolute -top-6 text-[8px] text-muted-foreground/50 whitespace-nowrap font-medium">
                    {gapLabel}
                  </span>
                )}

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

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} /> Management
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--warm-accent))' }} /> Verbal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--severity-serious))' }} /> Safety
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--info))' }} /> Written
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-current" style={{ boxShadow: '0 0 0 1.5px currentColor' }} /> Repeated person
        </span>
      </div>

      {/* Compact selected preview */}
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
