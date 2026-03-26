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

/* ── Top summary: max 2 lines, human language ── */

function deriveTopSummary(
  sorted: Incident[],
  gaps: number[],
): { primary: string; secondary: string | null } {
  if (sorted.length < 2) return { primary: `${sorted.length} record`, secondary: null };

  // Check frequency trend
  let trending: 'increasing' | 'decreasing' | null = null;
  if (gaps.length >= 4) {
    const recentAvg = (gaps[gaps.length - 1] + gaps[gaps.length - 2]) / 2;
    const earlierAvg = (gaps[gaps.length - 3] + gaps[gaps.length - 4]) / 2;
    if (earlierAvg > 0 && recentAvg <= earlierAvg * 0.75) trending = 'increasing';
    else if (recentAvg > 0 && recentAvg >= earlierAvg * 1.25 && earlierAvg > 0) trending = 'decreasing';
  }

  // Check clustering
  let hasCluster = false;
  for (let i = 1; i < sorted.length; i++) {
    const span = differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i - 1].incident_date));
    if (span <= 3) { hasCluster = true; break; }
  }

  // Check long pause followed by recent activity
  const longestGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const longestGapIdx = gaps.indexOf(longestGap);
  const hasPauseThenRecent = longestGap >= 21 && longestGapIdx < gaps.length - 1;

  // Primary line
  let primary = `${sorted.length} records over time`;
  if (trending === 'increasing') primary = 'Activity increasing';
  else if (hasPauseThenRecent) primary = 'Long pause followed by recent activity';
  else if (hasCluster) primary = 'Some incidents occurred close together';
  else if (trending === 'decreasing') primary = 'Activity decreasing';

  // Secondary line — no numbers, no duplication with escalation
  let secondary: string | null = null;
  if (trending === 'increasing' && hasCluster) {
    secondary = 'Several incidents occurred within a short period';
  } else if (hasPauseThenRecent && trending === 'increasing') {
    secondary = 'Recent records are more frequent than before';
  } else if (hasCluster && !hasPauseThenRecent) {
    secondary = 'Some events are grouped closely together';
  }

  return { primary, secondary };
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

  // Top summary (max 2 lines, human language)
  const topSummary = useMemo(() => deriveTopSummary(sorted, consecutiveGaps), [sorted, consecutiveGaps]);

  // Single escalation signal
  const escalation = useMemo(() => deriveEscalationSignal(sorted, sortedDates), [sorted, sortedDates]);

  // Check if chart should render (≥3 records spanning multiple days)
  const showChart = useMemo(() => {
    if (sortedDates.length < 3) return false;
    const span = differenceInDays(sortedDates[sortedDates.length - 1], sortedDates[0]);
    return span >= 2;
  }, [sortedDates]);

  // Dot visual data
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
      const recencyBoost = i >= sorted.length - 2 ? 2 : 0;
      const baseSize = (isCluster ? 14 : 10) + recencyBoost;

      return { inc, gap, spacing, isCluster, hasRing, color, baseSize };
    });
  }, [sorted, repeatedPeople]);

  // Month markers
  const monthMarkers = useMemo(() => {
    const allMarkers: { index: number; label: string }[] = [];
    let currentMonth = '';
    sorted.forEach((inc, i) => {
      const m = format(parseISO(inc.incident_date), 'MMM yyyy');
      if (m !== currentMonth) {
        allMarkers.push({ index: i, label: m });
        currentMonth = m;
      }
    });

    if (allMarkers.length <= 5) return allMarkers;

    const maxLabels = 5;
    const result: typeof allMarkers = [];
    for (let k = 0; k < maxLabels; k++) {
      const idx = Math.round((k / (maxLabels - 1)) * (allMarkers.length - 1));
      if (!result.find(r => r.index === allMarkers[idx].index)) {
        result.push(allMarkers[idx]);
      }
    }
    return result;
  }, [sorted]);

  const selectedIncident = sorted.find(i => i.id === selectedId);

  return (
    <div className="space-y-5">
      {/* Top summary — max 2 lines */}
      <div className="px-1">
        <p className="text-[14px] font-semibold text-foreground leading-snug">{topSummary.primary}</p>
        {topSummary.secondary && (
          <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">{topSummary.secondary}</p>
        )}
      </div>

      {/* Horizontal dot timeline */}
      <div ref={scrollRef} className="overflow-x-auto scrollbar-hide -mx-5 px-5">
        <div className="flex items-end min-w-max pb-6 pt-6 relative">
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

      {/* Escalation signal – single, only if clearly supported */}
      {escalation && (
        <div className="bg-primary/[0.04] border border-primary/[0.12] rounded-xl px-4 py-3">
          <p className="text-[13px] font-semibold text-foreground leading-snug">
            {escalation.headline}
          </p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
            {escalation.explanation}
          </p>
        </div>
      )}

      {/* Frequency chart — visual confirmation only, no explanation text */}
      {showChart && <FlowFrequencyChart dates={sortedDates} />}

      {/* Minimal legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted-foreground/50">
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
    </div>
  );
};

export default FlowTimeline;
