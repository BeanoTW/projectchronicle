import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
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

/* ── Zoom levels ── */
const ZOOM_LEVELS = [
  { name: 'Overview', spacingMin: 4, spacingMax: 20, dotBase: 8, labelMode: 'month' as const },
  { name: 'Mid',      spacingMin: 10, spacingMax: 48, dotBase: 10, labelMode: 'week' as const },
  { name: 'Detail',   spacingMin: 20, spacingMax: 80, dotBase: 12, labelMode: 'day' as const },
];

/* ── Top summary ── */
function deriveTopSummary(
  sorted: Incident[],
  gaps: number[],
): { primary: string; secondary: string | null } {
  if (sorted.length < 2) return { primary: `${sorted.length} record`, secondary: null };

  let trending: 'increasing' | 'decreasing' | null = null;
  if (gaps.length >= 4) {
    const recentAvg = (gaps[gaps.length - 1] + gaps[gaps.length - 2]) / 2;
    const earlierAvg = (gaps[gaps.length - 3] + gaps[gaps.length - 4]) / 2;
    if (earlierAvg > 0 && recentAvg <= earlierAvg * 0.75) trending = 'increasing';
    else if (recentAvg > 0 && recentAvg >= earlierAvg * 1.25 && earlierAvg > 0) trending = 'decreasing';
  }

  let hasCluster = false;
  for (let i = 1; i < sorted.length; i++) {
    const span = differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i - 1].incident_date));
    if (span <= 3) { hasCluster = true; break; }
  }

  const longestGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const longestGapIdx = gaps.indexOf(longestGap);
  const hasPauseThenRecent = longestGap >= 21 && longestGapIdx < gaps.length - 1;

  let primary = `${sorted.length} records over time`;
  if (trending === 'increasing') primary = 'Activity increasing';
  else if (hasPauseThenRecent) primary = 'Long pause followed by recent activity';
  else if (hasCluster) primary = 'Some incidents occurred close together';
  else if (trending === 'decreasing') primary = 'Activity decreasing';

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

/* ── Same-day grouping helper ── */
function groupByDay(sorted: Incident[]): { date: string; incidents: Incident[] }[] {
  const groups: { date: string; incidents: Incident[] }[] = [];
  for (const inc of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === inc.incident_date) {
      last.incidents.push(inc);
    } else {
      groups.push({ date: inc.incident_date, incidents: [inc] });
    }
  }
  return groups;
}

const FlowTimeline = ({ incidents, repeatedPeople, totalIncidents, mostFrequentPerson }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 0=overview, 1=mid, 2=detail

  // Drag state
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });
  // Pinch state
  const pinchState = useRef({ initialDist: 0, initialZoom: 1 });

  const sorted = useMemo(() =>
    [...incidents]
      .filter(i => isValid(parseISO(i.incident_date)))
      .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime()),
    [incidents]
  );

  const sortedDates = useMemo(() => sorted.map(i => parseISO(i.incident_date)), [sorted]);

  const consecutiveGaps = useMemo(() => {
    const g: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      g.push(differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i - 1].incident_date)));
    }
    return g;
  }, [sorted]);

  const topSummary = useMemo(() => deriveTopSummary(sorted, consecutiveGaps), [sorted, consecutiveGaps]);
  const escalation = useMemo(() => deriveEscalationSignal(sorted, sortedDates), [sorted, sortedDates]);

  const showChart = useMemo(() => {
    if (sortedDates.length < 3) return false;
    const span = differenceInDays(sortedDates[sortedDates.length - 1], sortedDates[0]);
    return span >= 2;
  }, [sortedDates]);

  const zoom = ZOOM_LEVELS[zoomLevel];

  // Day groups for detail zoom
  const dayGroups = useMemo(() => groupByDay(sorted), [sorted]);

  // Build dot data based on zoom level
  const dotData = useMemo(() => {
    if (sorted.length === 0) return [];

    return sorted.map((inc, i) => {
      const gap = i > 0
        ? differenceInDays(parseISO(inc.incident_date), parseISO(sorted[i - 1].incident_date))
        : 0;

      const spacing = i === 0 ? 0 : Math.max(
        zoom.spacingMin,
        Math.min(zoom.spacingMax, zoom.spacingMin + (gap / 30) * (zoom.spacingMax - zoom.spacingMin))
      );

      const isCluster = gap <= 3 && i > 0;
      const hasRing = inc.people_involved.some(p => repeatedPeople.has(p));
      const color = categoryColors[inc.category || ''] || 'hsl(var(--muted-foreground))';
      const recencyBoost = i >= sorted.length - 2 ? 2 : 0;
      const baseSize = (isCluster ? zoom.dotBase + 4 : zoom.dotBase) + recencyBoost;

      // Same-day grouping info
      const sameDayGroup = dayGroups.find(g => g.date === inc.incident_date);
      const sameDayCount = sameDayGroup ? sameDayGroup.incidents.length : 1;
      const isFirstInDay = sameDayGroup ? sameDayGroup.incidents[0].id === inc.id : true;

      return { inc, gap, spacing, isCluster, hasRing, color, baseSize, sameDayCount, isFirstInDay };
    });
  }, [sorted, repeatedPeople, zoom, dayGroups]);

  // Labels based on zoom level
  const labels = useMemo(() => {
    const result: { index: number; label: string }[] = [];

    if (zoom.labelMode === 'month') {
      let currentMonth = '';
      sorted.forEach((inc, i) => {
        const m = format(parseISO(inc.incident_date), 'MMM yyyy');
        if (m !== currentMonth) {
          result.push({ index: i, label: m });
          currentMonth = m;
        }
      });
      // Cap at 5
      if (result.length > 5) {
        const sampled: typeof result = [];
        for (let k = 0; k < 5; k++) {
          const idx = Math.round((k / 4) * (result.length - 1));
          if (!sampled.find(r => r.index === result[idx].index)) sampled.push(result[idx]);
        }
        return sampled;
      }
    } else if (zoom.labelMode === 'week') {
      let lastWeekLabel = '';
      sorted.forEach((inc, i) => {
        const d = parseISO(inc.incident_date);
        const weekLabel = format(d, "'w'II MMM");
        const monthLabel = format(d, 'MMM yyyy');
        // Show month start or every ~7 days
        if (monthLabel !== lastWeekLabel) {
          result.push({ index: i, label: monthLabel });
          lastWeekLabel = monthLabel;
        } else if (i > 0) {
          const gapDays = differenceInDays(d, parseISO(sorted[i - 1].incident_date));
          if (gapDays >= 7) {
            result.push({ index: i, label: format(d, 'd MMM') });
          }
        }
      });
      if (result.length > 8) {
        const sampled: typeof result = [];
        for (let k = 0; k < 8; k++) {
          const idx = Math.round((k / 7) * (result.length - 1));
          if (!sampled.find(r => r.index === result[idx].index)) sampled.push(result[idx]);
        }
        return sampled;
      }
    } else {
      // Detail: show date for each incident or group
      const seen = new Set<string>();
      sorted.forEach((inc, i) => {
        const dateStr = format(parseISO(inc.incident_date), 'd MMM yyyy');
        if (!seen.has(dateStr)) {
          result.push({ index: i, label: dateStr });
          seen.add(dateStr);
        }
      });
      // Cap at 12
      if (result.length > 12) {
        const sampled: typeof result = [];
        for (let k = 0; k < 12; k++) {
          const idx = Math.round((k / 11) * (result.length - 1));
          if (!sampled.find(r => r.index === result[idx].index)) sampled.push(result[idx]);
        }
        return sampled;
      }
    }

    return result;
  }, [sorted, zoom.labelMode]);

  // ── Drag handlers ──
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    dragState.current = { isDragging: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDragging) return;
    const el = containerRef.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    el.scrollLeft = dragState.current.scrollLeft - dx;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.isDragging = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  // ── Pinch-to-zoom ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchState.current = { initialDist: Math.hypot(dx, dy), initialZoom: zoomLevel };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchState.current.initialDist;

      if (ratio > 1.3 && pinchState.current.initialZoom < 2) {
        setZoomLevel(Math.min(2, pinchState.current.initialZoom + 1));
        pinchState.current.initialDist = dist;
        pinchState.current.initialZoom = Math.min(2, pinchState.current.initialZoom + 1);
      } else if (ratio < 0.7 && pinchState.current.initialZoom > 0) {
        setZoomLevel(Math.max(0, pinchState.current.initialZoom - 1));
        pinchState.current.initialDist = dist;
        pinchState.current.initialZoom = Math.max(0, pinchState.current.initialZoom - 1);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [zoomLevel]);

  // ── Wheel zoom (desktop) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0 && zoomLevel < 2) setZoomLevel(z => Math.min(2, z + 1));
        else if (e.deltaY > 0 && zoomLevel > 0) setZoomLevel(z => Math.max(0, z - 1));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomLevel]);

  // ── Auto-centre on selection ──
  const handleSelect = useCallback((id: string, dotIndex: number) => {
    setSelectedId(prev => prev === id ? null : id);

    // Scroll to centre the dot
    const el = containerRef.current;
    const timeline = timelineRef.current;
    if (!el || !timeline) return;
    const dots = timeline.querySelectorAll('[data-dot-index]');
    const dot = dots[dotIndex] as HTMLElement | undefined;
    if (dot) {
      const dotCenter = dot.offsetLeft + dot.offsetWidth / 2;
      const containerWidth = el.clientWidth;
      el.scrollTo({ left: dotCenter - containerWidth / 2, behavior: 'smooth' });
    }
  }, []);

  const selectedIncident = sorted.find(i => i.id === selectedId);

  return (
    <div className="space-y-5">
      {/* Top summary */}
      <div className="px-1">
        <p className="text-[14px] font-semibold text-foreground leading-snug">{topSummary.primary}</p>
        {topSummary.secondary && (
          <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">{topSummary.secondary}</p>
        )}
      </div>

      {/* Zoom level indicator */}
      <div className="flex items-center gap-1.5 px-1">
        {ZOOM_LEVELS.map((z, i) => (
          <button
            key={z.name}
            onClick={() => setZoomLevel(i)}
            className={`text-[10px] px-2.5 py-1 rounded-full transition-all duration-200 ${
              i === zoomLevel
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground/50 hover:text-muted-foreground'
            }`}
          >
            {z.name}
          </button>
        ))}
      </div>

      {/* Interactive dot timeline */}
      <div
        ref={containerRef}
        className="overflow-x-auto scrollbar-hide -mx-5 px-5 cursor-grab active:cursor-grabbing touch-pan-x"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={timelineRef}
          className="flex items-end min-w-max pb-7 pt-6 relative transition-all duration-300"
        >
          {/* Baseline */}
          <div className="absolute bottom-[24px] left-0 right-0 h-[1.5px] bg-border" />

          {dotData.map((d, i) => {
            const isSelected = selectedId === d.inc.id;
            const label = labels.find(m => m.index === i);

            // In overview/mid, hide non-first same-day dots by stacking
            const isHiddenInGroup = zoomLevel < 2 && d.sameDayCount > 1 && !d.isFirstInDay;

            if (isHiddenInGroup) return null;

            return (
              <div
                key={d.inc.id}
                data-dot-index={i}
                className="relative flex flex-col items-center"
                style={{
                  marginLeft: d.spacing,
                  transition: 'margin-left 0.3s ease',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(d.inc.id, i);
                  }}
                  className="relative z-10 min-w-[28px] min-h-[28px] flex items-center justify-center"
                  aria-label={`Incident on ${d.inc.incident_date}`}
                >
                  <motion.div
                    layout
                    className="rounded-full"
                    style={{
                      width: isSelected ? d.baseSize * 1.4 : d.baseSize,
                      height: isSelected ? d.baseSize * 1.4 : d.baseSize,
                      backgroundColor: d.color,
                      boxShadow: isSelected
                        ? `0 0 0 3px hsl(var(--background)), 0 0 0 5px ${d.color}`
                        : d.hasRing
                          ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${d.color}`
                          : 'none',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />

                  {/* Same-day count badge */}
                  {d.sameDayCount > 1 && d.isFirstInDay && zoomLevel < 2 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                      {d.sameDayCount}
                    </span>
                  )}
                </button>

                {label && (
                  <span className="absolute -bottom-5 text-[9px] text-muted-foreground/50 whitespace-nowrap select-none">
                    {label.label}
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

      {/* Escalation signal */}
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

      {/* Frequency chart */}
      {showChart && <FlowFrequencyChart dates={sortedDates} />}

      {/* Legend */}
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
