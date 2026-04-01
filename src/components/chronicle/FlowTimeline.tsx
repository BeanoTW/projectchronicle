import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { format, parseISO, differenceInDays, isValid, startOfDay, addDays, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';
import { deriveEscalationSignal } from '@/lib/flowEscalation';
import { ZoomIn } from 'lucide-react';

/* ── Category colours ── */
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

/* ── 4 zoom levels (0-3) ── */
const ZOOM_LEVELS = [
  { name: 'Overview',   dotSize: 6,  dotOpacity: 0.5, curveOpacity: 0.6,  spacing: 8,   labelMode: 'month' as const },
  { name: 'Mid',        dotSize: 10, dotOpacity: 0.8, curveOpacity: 0.35, spacing: 24,  labelMode: 'week' as const },
  { name: 'Detail',     dotSize: 12, dotOpacity: 1,   curveOpacity: 0.15, spacing: 48,  labelMode: 'day' as const },
  { name: 'Structured', dotSize: 14, dotOpacity: 1,   curveOpacity: 0.06, spacing: 80,  labelMode: 'day-full' as const },
];

const MAX_ZOOM = ZOOM_LEVELS.length - 1;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function getInterpolatedZoom(z: number) {
  const clamped = Math.max(0, Math.min(MAX_ZOOM, z));
  const lower = Math.floor(clamped);
  const upper = Math.min(MAX_ZOOM, lower + 1);
  const t = clamped - lower;
  const lo = ZOOM_LEVELS[lower];
  const hi = ZOOM_LEVELS[upper];
  return {
    dotSize: lerp(lo.dotSize, hi.dotSize, t),
    dotOpacity: lerp(lo.dotOpacity, hi.dotOpacity, t),
    curveOpacity: lerp(lo.curveOpacity, hi.curveOpacity, t),
    spacing: lerp(lo.spacing, hi.spacing, t),
    labelMode: t < 0.5 ? lo.labelMode : hi.labelMode,
    name: t < 0.5 ? lo.name : hi.name,
    isStructured: clamped >= 2.5,
  };
}

/* ── Top summary (single signal) ── */
function deriveTopSummary(sorted: Incident[], gaps: number[]): { primary: string; secondary: string | null } {
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
    if (differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i - 1].incident_date)) <= 3) { hasCluster = true; break; }
  }
  const longestGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const longestGapIdx = gaps.indexOf(longestGap);
  const hasPauseThenRecent = longestGap >= 21 && longestGapIdx < gaps.length - 1;

  let primary = `${sorted.length} records over time`;
  if (trending === 'increasing') primary = 'Activity increasing';
  else if (hasPauseThenRecent) primary = 'Long pause followed by recent activity';
  else if (hasCluster) primary = 'Some incidents occurred close together';
  else if (trending === 'decreasing') primary = 'Activity decreasing';

  return { primary, secondary: null };
}

/* ── Density computation: returns normalised density [0,1] at each x position ── */
function computeDensityAtPositions(positions: number[], windowRadius: number): number[] {
  if (positions.length === 0) return [];
  const densities = positions.map(px => {
    let d = 0;
    for (const other of positions) {
      const dist = Math.abs(px - other);
      if (dist < windowRadius) d += 1 - dist / windowRadius;
    }
    return d;
  });
  const max = Math.max(...densities, 1);
  return densities.map(d => d / max);
}

/* ── Build SVG curve path from positions and their densities ── */
function buildCurvePath(
  totalWidth: number,
  curveHeight: number,
  positions: number[],
): string {
  if (positions.length < 2) return '';

  const sampleCount = Math.max(20, Math.min(60, Math.floor(totalWidth / 8)));
  const maxX = positions[positions.length - 1] || totalWidth;
  const minX = positions[0] || 0;
  const range = maxX - minX || 1;
  const windowRadius = range / sampleCount * 1.5;

  const points: { x: number; y: number }[] = [];
  let maxDensity = 0;

  for (let s = 0; s <= sampleCount; s++) {
    const x = minX + (s / sampleCount) * range;
    let density = 0;
    for (const px of positions) {
      const dist = Math.abs(px - x);
      if (dist < windowRadius) density += 1 - (dist / windowRadius);
    }
    if (density > maxDensity) maxDensity = density;
    points.push({ x, y: density });
  }

  if (maxDensity === 0) return '';

  const normalized = points.map(p => ({
    x: p.x,
    y: curveHeight - (p.y / maxDensity) * (curveHeight * 0.7),
  }));

  let d = `M ${normalized[0].x} ${curveHeight}`;
  d += ` L ${normalized[0].x} ${normalized[0].y}`;

  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  d += ` L ${normalized[normalized.length - 1].x} ${curveHeight}`;
  d += ' Z';
  return d;
}

const HINT_KEY = 'chronicle_timeline_hint_dismissed';
const PINCH_THRESHOLD = 12; // px distance change before zoom activates

/* ═══════════════════════════════════════════════ */
const FlowTimeline = ({ incidents, repeatedPeople, totalIncidents, mostFrequentPerson }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const continuousZoom = useMotionValue(0);
  const smoothZoom = useSpring(continuousZoom, { stiffness: 280, damping: 30 });
  const [renderZoom, setRenderZoom] = useState(0);

  const [showHint, setShowHint] = useState(() => {
    try { return !localStorage.getItem(HINT_KEY); } catch { return true; }
  });

  // Gesture state refs
  const gestureRef = useRef<{
    type: 'none' | 'scroll' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    scrollLeft: number;
    movedEnough: boolean;
    pinchInitialDist: number;
    pinchInitialZoom: number;
    pinchActivated: boolean;
  }>({
    type: 'none', startX: 0, startY: 0, scrollLeft: 0, movedEnough: false,
    pinchInitialDist: 0, pinchInitialZoom: 0, pinchActivated: false,
  });

  /* ── Sorted data ── */
  const sorted = useMemo(() =>
    [...incidents].filter(i => isValid(parseISO(i.incident_date)))
      .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime()),
    [incidents]
  );
  const sortedDates = useMemo(() => sorted.map(i => parseISO(i.incident_date)), [sorted]);
  const consecutiveGaps = useMemo(() => {
    const g: number[] = [];
    for (let i = 1; i < sorted.length; i++) g.push(differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i - 1].incident_date)));
    return g;
  }, [sorted]);

  const topSummary = useMemo(() => deriveTopSummary(sorted, consecutiveGaps), [sorted, consecutiveGaps]);
  const escalation = useMemo(() => deriveEscalationSignal(sorted, sortedDates), [sorted, sortedDates]);

  useEffect(() => {
    const unsub = smoothZoom.on('change', v => setRenderZoom(v));
    return unsub;
  }, [smoothZoom]);

  const iz = useMemo(() => getInterpolatedZoom(renderZoom), [renderZoom]);
  const activeLevel = Math.round(Math.max(0, Math.min(MAX_ZOOM, renderZoom)));

  /* ── Structured Detail: day columns ── */
  const structuredDays = useMemo(() => {
    if (sorted.length < 2) return [];
    const first = parseISO(sorted[0].incident_date);
    const last = parseISO(sorted[sorted.length - 1].incident_date);
    const days = eachDayOfInterval({ start: startOfDay(first), end: startOfDay(last) });

    const eventDaySet = new Set(sorted.map(i => format(parseISO(i.incident_date), 'yyyy-MM-dd')));
    const relevantDays = days.filter(d => {
      const key = format(d, 'yyyy-MM-dd');
      if (eventDaySet.has(key)) return true;
      const prev = format(addDays(d, -1), 'yyyy-MM-dd');
      const next = format(addDays(d, 1), 'yyyy-MM-dd');
      return eventDaySet.has(prev) || eventDaySet.has(next);
    });

    const maxDays = 60;
    const sampled = relevantDays.length > maxDays
      ? relevantDays.filter((_, i) => i % Math.ceil(relevantDays.length / maxDays) === 0)
      : relevantDays;

    return sampled.map(d => {
      const key = format(d, 'yyyy-MM-dd');
      return { date: d, key, incidents: sorted.filter(inc => inc.incident_date === key) };
    });
  }, [sorted]);

  /* ── Dot positions (x) ── */
  const dotPositions = useMemo(() => {
    if (sorted.length === 0) return [];
    let x = 20;
    return sorted.map((inc, i) => {
      if (i > 0) {
        const gap = differenceInDays(parseISO(inc.incident_date), parseISO(sorted[i - 1].incident_date));
        const gapFactor = Math.max(0.3, Math.min(1, gap / 30));
        x += iz.spacing * gapFactor + iz.spacing * 0.3;
      }
      return x;
    });
  }, [sorted, iz.spacing]);

  const timelineWidth = useMemo(() => {
    if (iz.isStructured) return Math.max(350, structuredDays.length * iz.spacing + 60);
    return dotPositions.length > 0 ? dotPositions[dotPositions.length - 1] + 40 : 350;
  }, [iz.isStructured, structuredDays, dotPositions, iz.spacing]);

  const CURVE_HEIGHT = 80;

  /* ── Density at each dot position (for vertical placement on curve) ── */
  const dotDensities = useMemo(() => {
    if (dotPositions.length < 2) return dotPositions.map(() => 0);
    const range = (dotPositions[dotPositions.length - 1] - dotPositions[0]) || 1;
    const windowRadius = range / Math.max(20, Math.min(60, Math.floor(timelineWidth / 8))) * 1.5;
    return computeDensityAtPositions(dotPositions, windowRadius);
  }, [dotPositions, timelineWidth]);

  /* ── SVG curve path ── */
  const curvePath = useMemo(() => {
    if (iz.isStructured) {
      const dayXPositions = structuredDays
        .filter(d => d.incidents.length > 0)
        .map(d => {
          const idx = structuredDays.indexOf(d);
          return 30 + idx * iz.spacing;
        });
      return buildCurvePath(timelineWidth, CURVE_HEIGHT, dayXPositions);
    }
    return buildCurvePath(timelineWidth, CURVE_HEIGHT, dotPositions);
  }, [timelineWidth, dotPositions, iz.isStructured, structuredDays, iz.spacing]);

  /* ── Labels ── */
  const labels = useMemo(() => {
    if (iz.isStructured) return [];
    const mode = iz.labelMode;
    const result: { posIndex: number; label: string }[] = [];

    if (mode === 'month') {
      let currentMonth = '';
      sorted.forEach((inc, i) => {
        const m = format(parseISO(inc.incident_date), 'MMM yyyy');
        if (m !== currentMonth) { result.push({ posIndex: i, label: m }); currentMonth = m; }
      });
      if (result.length > 5) {
        const sampled: typeof result = [];
        for (let k = 0; k < 5; k++) sampled.push(result[Math.round((k / 4) * (result.length - 1))]);
        return sampled;
      }
    } else if (mode === 'week') {
      let lastLabel = '';
      sorted.forEach((inc, i) => {
        const d = parseISO(inc.incident_date);
        const ml = format(d, 'MMM yyyy');
        if (ml !== lastLabel) { result.push({ posIndex: i, label: ml }); lastLabel = ml; }
        else if (i > 0 && differenceInDays(d, parseISO(sorted[i - 1].incident_date)) >= 7) {
          result.push({ posIndex: i, label: format(d, 'd MMM') });
        }
      });
      if (result.length > 8) {
        const sampled: typeof result = [];
        for (let k = 0; k < 8; k++) sampled.push(result[Math.round((k / 7) * (result.length - 1))]);
        return sampled;
      }
    } else {
      const seen = new Set<string>();
      sorted.forEach((inc, i) => {
        const ds = format(parseISO(inc.incident_date), 'd MMM yyyy');
        if (!seen.has(ds)) { result.push({ posIndex: i, label: ds }); seen.add(ds); }
      });
      if (result.length > 10) {
        const sampled: typeof result = [];
        for (let k = 0; k < 10; k++) sampled.push(result[Math.round((k / 9) * (result.length - 1))]);
        return sampled;
      }
    }
    return result;
  }, [sorted, iz.labelMode, iz.isStructured]);

  /* ── Hint dismiss ── */
  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem(HINT_KEY, '1'); } catch {}
  }, []);
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(dismissHint, 6000);
    return () => clearTimeout(t);
  }, [showHint, dismissHint]);

  /* ── Snap ── */
  const snapToLevel = useCallback((level: number) => {
    continuousZoom.set(Math.max(0, Math.min(MAX_ZOOM, level)));
  }, [continuousZoom]);

  /* ════════════════════════════════════════════
     GESTURE HANDLING — directional locking model
     ════════════════════════════════════════════ */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const g = gestureRef.current;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Two-finger: prepare for pinch
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        g.type = 'pinch';
        g.pinchInitialDist = Math.hypot(dx, dy);
        g.pinchInitialZoom = continuousZoom.get();
        g.pinchActivated = false;
        g.movedEnough = false;
      } else if (e.touches.length === 1) {
        // Single finger: direction TBD
        g.type = 'none';
        g.startX = e.touches[0].clientX;
        g.startY = e.touches[0].clientY;
        g.scrollLeft = el.scrollLeft;
        g.movedEnough = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch zoom
        if (g.type !== 'pinch') {
          // Transitioned from single to double — init pinch
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          g.type = 'pinch';
          g.pinchInitialDist = Math.hypot(dx, dy);
          g.pinchInitialZoom = continuousZoom.get();
          g.pinchActivated = false;
        }

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const delta = Math.abs(dist - g.pinchInitialDist);

        // Only activate zoom after threshold
        if (!g.pinchActivated) {
          if (delta < PINCH_THRESHOLD) return; // let page scroll
          g.pinchActivated = true;
          g.pinchInitialDist = dist; // reset baseline
          g.pinchInitialZoom = continuousZoom.get();
          dismissHint();
        }

        // Prevent scroll during active pinch
        e.preventDefault();

        const ratio = dist / g.pinchInitialDist;
        const raw = g.pinchInitialZoom + Math.log2(ratio) * 1.5;
        let target: number;
        if (raw < 0) target = -0.12 * Math.tanh(-raw / 0.12);
        else if (raw > MAX_ZOOM) target = MAX_ZOOM + 0.12 * Math.tanh((raw - MAX_ZOOM) / 0.12);
        else target = raw;
        continuousZoom.set(target);
        return;
      }

      if (e.touches.length !== 1) return;

      const moveX = e.touches[0].clientX - g.startX;
      const moveY = e.touches[0].clientY - g.startY;

      // Direction lock: decide once
      if (g.type === 'none') {
        const absMoveX = Math.abs(moveX);
        const absMoveY = Math.abs(moveY);
        // Need minimum movement to decide
        if (absMoveX < 5 && absMoveY < 5) return;

        if (absMoveY > absMoveX) {
          // Vertical wins → allow page scroll, do nothing
          g.type = 'scroll';
          return;
        } else {
          // Horizontal wins → pan timeline (only at Detail+ zoom)
          const currentZoom = continuousZoom.get();
          if (currentZoom >= 1.5) {
            g.type = 'pan';
          } else {
            // At Overview/low-Mid, allow page to handle
            g.type = 'scroll';
            return;
          }
        }
      }

      if (g.type === 'pan') {
        e.preventDefault();
        if (Math.abs(moveX) > 3) g.movedEnough = true;
        el.scrollLeft = g.scrollLeft - moveX;
      }
      // g.type === 'scroll' → do nothing, browser handles it
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (g.type === 'pinch' && e.touches.length < 2) {
        // Snap to nearest level
        if (g.pinchActivated) {
          const c = continuousZoom.get();
          snapToLevel(Math.round(Math.max(0, Math.min(MAX_ZOOM, c))));
        }
      }
      if (e.touches.length === 0) {
        g.type = 'none';
      }
    };

    // Use passive: false on touchmove so we can conditionally preventDefault
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [continuousZoom, snapToLevel, dismissHint]);

  /* ── Desktop: mouse drag for pan ── */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle mouse, not touch (touch is handled above)
    if (e.pointerType === 'touch') return;
    const el = containerRef.current;
    if (!el) return;
    const g = gestureRef.current;
    g.type = 'pan';
    g.startX = e.clientX;
    g.scrollLeft = el.scrollLeft;
    g.movedEnough = false;
    el.setPointerCapture(e.pointerId);
  }, []);
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const g = gestureRef.current;
    if (g.type !== 'pan') return;
    const el = containerRef.current;
    if (!el) return;
    const dx = e.clientX - g.startX;
    if (Math.abs(dx) > 3) g.movedEnough = true;
    el.scrollLeft = g.scrollLeft - dx;
  }, []);
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    gestureRef.current.type = 'none';
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  /* ── Wheel zoom (Ctrl/Cmd + scroll) ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const c = continuousZoom.get();
        snapToLevel(Math.round(Math.max(0, Math.min(MAX_ZOOM, c + (e.deltaY < 0 ? 1 : -1)))));
        dismissHint();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [continuousZoom, snapToLevel, dismissHint]);

  /* ── Select ── */
  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const selectedIncident = sorted.find(i => i.id === selectedId);

  /* ═══ RENDER ═══ */
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="px-1">
        <p className="text-[14px] font-semibold text-foreground leading-snug">{topSummary.primary}</p>
      </div>

      {/* Zoom tabs */}
      <div className="flex items-center gap-1 px-1">
        {ZOOM_LEVELS.map((z, i) => (
          <button
            key={z.name}
            onClick={() => { snapToLevel(i); dismissHint(); }}
            className={`text-[10px] px-2.5 py-1 rounded-full transition-all duration-300 ${
              i === activeLevel
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground/50 hover:text-muted-foreground'
            }`}
          >
            {z.name}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 mr-1">
          {ZOOM_LEVELS.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300" style={{
              width: 4, height: 4,
              backgroundColor: i <= activeLevel ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.15)',
            }} />
          ))}
        </div>
      </div>

      {/* Hint */}
      <AnimatePresence>
        {showHint && sorted.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}
            className="flex items-center gap-2 px-3 py-2 mx-1 rounded-lg bg-primary/[0.05] border border-primary/[0.08]"
          >
            <ZoomIn className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground">Pinch to explore timeline depth</span>
            <button onClick={dismissHint} className="ml-auto text-[10px] text-muted-foreground/40 hover:text-muted-foreground">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ UNIFIED TIMELINE CANVAS ═══ */}
      <div
        ref={containerRef}
        className="overflow-x-auto scrollbar-hide -mx-5 px-5 relative"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="relative" style={{ width: timelineWidth, minHeight: iz.isStructured ? 200 : CURVE_HEIGHT + 60 }}>

          {/* ── Single activity curve (all levels) ── */}
          {curvePath && (
            <svg
              width={timelineWidth}
              height={CURVE_HEIGHT}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ opacity: iz.curveOpacity, transition: 'opacity 0.4s ease' }}
            >
              <defs>
                <linearGradient id="activityCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <path d={curvePath} fill="url(#activityCurveGrad)" />
              <path
                d={curvePath.replace(/ Z$/, '').replace(/M [^ ]+ [^ ]+ L /, 'M ').replace(/ L [^ ]+ [^ ]+$/, '')}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />
            </svg>
          )}

          {/* ── Dot layer (Overview / Mid / Detail) ── */}
          {!iz.isStructured && (
            <div className="absolute left-0 right-0 top-0" style={{ height: CURVE_HEIGHT + 40 }}>
              {sorted.map((inc, i) => {
                const x = dotPositions[i];
                if (x === undefined) return null;
                const isSelected = selectedId === inc.id;
                const hasRing = inc.people_involved.some(p => repeatedPeople.has(p));
                const color = categoryColors[inc.category || ''] || 'hsl(var(--muted-foreground))';
                const label = labels.find(l => l.posIndex === i);

                // Density-based Y: dots sit ON the curve
                // density=1 → top of curve, density=0 → baseline
                const density = dotDensities[i] ?? 0;
                const curveY = CURVE_HEIGHT - density * (CURVE_HEIGHT * 0.7);
                // As zoom increases, dots drop toward a flat baseline
                const baselineY = CURVE_HEIGHT - 4;
                // At Overview (renderZoom=0), dots are fully on the curve
                // At Detail (renderZoom=2+), dots are on the baseline
                const curveInfluence = Math.max(0, 1 - renderZoom / 1.5);
                const dotY = lerp(baselineY, curveY, curveInfluence);

                // Same day stacking
                const sameDayAsPrev = i > 0 && sorted[i - 1].incident_date === inc.incident_date;
                const yOffset = sameDayAsPrev ? -iz.dotSize * 0.8 : 0;

                return (
                  <motion.div
                    key={inc.id}
                    className="absolute flex flex-col items-center"
                    animate={{
                      left: x - iz.dotSize / 2,
                      top: dotY - iz.dotSize / 2 + yOffset,
                      opacity: iz.dotOpacity,
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 0.8 }}
                  >
                    <button
                      onClick={(e) => {
                        if (gestureRef.current.movedEnough) return;
                        e.stopPropagation();
                        handleSelect(inc.id);
                      }}
                      className="relative z-10 flex items-center justify-center"
                      style={{ width: Math.max(28, iz.dotSize * 2.5), height: Math.max(28, iz.dotSize * 2.5) }}
                      aria-label={`Incident on ${inc.incident_date}`}
                    >
                      <motion.div
                        className="rounded-full"
                        animate={{
                          width: isSelected ? iz.dotSize * 1.6 : iz.dotSize,
                          height: isSelected ? iz.dotSize * 1.6 : iz.dotSize,
                          backgroundColor: color,
                          boxShadow: isSelected
                            ? `0 0 0 3px hsl(var(--background)), 0 0 0 5px ${color}, 0 0 12px ${color}40`
                            : hasRing
                              ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${color}`
                              : '0 0 0 0px transparent',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        whileTap={{ scale: 1.3 }}
                      />
                    </button>

                    {/* Label */}
                    {label && (
                      <span
                        className="absolute text-muted-foreground whitespace-nowrap select-none"
                        style={{ top: iz.dotSize + 14, fontSize: 9, opacity: 0.5 }}
                      >
                        {label.label}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── Structured Detail (day columns) ── */}
          {iz.isStructured && (
            <div className="absolute left-0 right-0 top-0" style={{ paddingTop: CURVE_HEIGHT + 4 }}>
              <div className="flex" style={{ gap: 0 }}>
                {structuredDays.map((day, dayIdx) => {
                  const hasEvents = day.incidents.length > 0;
                  const dayLabel = format(day.date, 'EEE');
                  const dateLabel = format(day.date, 'd MMM');

                  return (
                    <motion.div
                      key={day.key}
                      className="flex flex-col items-center flex-shrink-0"
                      animate={{ width: iz.spacing }}
                      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    >
                      <div className="text-center mb-2">
                        <span className="text-[8px] text-muted-foreground/40 uppercase tracking-wider block">{dayLabel}</span>
                        <span className="text-[10px] text-muted-foreground/60 font-medium">{dateLabel}</span>
                      </div>

                      <div className={`w-[1px] flex-1 min-h-[60px] relative ${hasEvents ? 'bg-border/40' : 'bg-border/15'}`}>
                        {day.incidents.map((inc, eIdx) => {
                          const isSelected = selectedId === inc.id;
                          const color = categoryColors[inc.category || ''] || 'hsl(var(--muted-foreground))';
                          const hasRing = inc.people_involved.some(p => repeatedPeople.has(p));
                          const yPos = 8 + eIdx * 28;

                          return (
                            <motion.div
                              key={inc.id}
                              className="absolute left-1/2 flex items-center gap-1.5"
                              style={{ top: yPos, transform: 'translateX(-50%)' }}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: dayIdx * 0.01, duration: 0.2 }}
                            >
                              <button
                                onClick={(e) => {
                                  if (gestureRef.current.movedEnough) return;
                                  e.stopPropagation();
                                  handleSelect(inc.id);
                                }}
                                className="relative z-10 flex items-center justify-center"
                                style={{ width: 32, height: 32 }}
                              >
                                <motion.div
                                  className="rounded-full"
                                  animate={{
                                    width: isSelected ? iz.dotSize * 1.4 : iz.dotSize,
                                    height: isSelected ? iz.dotSize * 1.4 : iz.dotSize,
                                    backgroundColor: color,
                                    boxShadow: isSelected
                                      ? `0 0 0 3px hsl(var(--background)), 0 0 0 5px ${color}, 0 0 10px ${color}30`
                                      : hasRing
                                        ? `0 0 0 2px hsl(var(--background)), 0 0 0 3px ${color}`
                                        : 'none',
                                  }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                  whileTap={{ scale: 1.2 }}
                                />
                              </button>

                              {inc.incident_time && (
                                <span className="text-[9px] text-primary/70 font-medium whitespace-nowrap absolute -left-1 -top-3">
                                  {inc.incident_time}
                                </span>
                              )}

                              <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none">
                                {(inc.category || 'Event').split(' ').slice(0, 2).join(' ')}
                              </span>
                            </motion.div>
                          );
                        })}

                        {!hasEvents && (
                          <div className="absolute left-1/2 top-4 -translate-x-1/2">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/10" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Selected record card ── */}
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

      {/* ── Escalation signal ── */}
      {escalation && (
        <div className="bg-primary/[0.04] border border-primary/[0.12] rounded-xl px-4 py-3">
          <p className="text-[13px] font-semibold text-foreground leading-snug">{escalation.headline}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{escalation.explanation}</p>
        </div>
      )}

      {/* ── Interaction hints ── */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/35 select-none">
        <span>Pinch to zoom</span>
        <span>·</span>
        <span>Drag to pan</span>
        <span>·</span>
        <span>Tap any event</span>
      </div>

      {/* ── Legend ── */}
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
