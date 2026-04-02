/**
 * FlowTimeline — Integrated Activity System
 *
 * Three connected components driven from ONE shared data model:
 *   1. Density curve (SVG) — rolling window density
 *   2. Dot strip — individual incident dots on timeline
 *   3. Insight card — data-driven, neutral text
 *
 * Selection state is shared: tapping a dot highlights
 * the corresponding region on the chart and updates the insight.
 * Tapping the chart highlights corresponding dots.
 */

import { useRef, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';
import {
  buildActivityModel,
  computeInsight,
  densityAt,
  type ActivityModel,
  type ActivitySelection,
  type DotStripGroup,
} from '@/lib/activityModel';

/* ── Category colours using design tokens ── */
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
  'Other': 'hsl(var(--muted-foreground))',
};

function getColor(category: string): string {
  return categoryColors[category] || 'hsl(var(--muted-foreground))';
}

/* ── Chart geometry ── */
const CHART_W = 362;
const CHART_H = 140;
const PAD_L = 12;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 20;

function toX(norm: number): number {
  return PAD_L + norm * (CHART_W - PAD_L - PAD_R);
}
function toY(val: number): number {
  return CHART_H - PAD_B - val * (CHART_H - PAD_T - PAD_B);
}

/* ── Build SVG path from density samples ── */
function buildCurvePath(model: ActivityModel): string {
  const { density } = model;
  if (density.length === 0) return '';
  let d = `M ${toX(density[0].norm)} ${toY(density[0].value)}`;
  for (let i = 1; i < density.length; i++) {
    d += ` L ${toX(density[i].norm)} ${toY(density[i].value)}`;
  }
  return d;
}

function buildAreaPath(model: ActivityModel): string {
  const { density } = model;
  if (density.length === 0) return '';
  let d = `M ${toX(density[0].norm)} ${toY(density[0].value)}`;
  for (let i = 1; i < density.length; i++) {
    d += ` L ${toX(density[i].norm)} ${toY(density[i].value)}`;
  }
  d += ` L ${toX(1)} ${toY(0)} L ${toX(0)} ${toY(0)} Z`;
  return d;
}

/* ── Date axis labels ── */
function buildDateLabels(model: ActivityModel): { norm: number; label: string }[] {
  const { totalMin, totalRange, events } = model;
  if (events.length === 0) return [];

  const count = Math.min(5, Math.max(2, events.length));
  const labels: { norm: number; label: string }[] = [];

  for (let i = 0; i < count; i++) {
    const norm = i / (count - 1);
    const t = totalMin + norm * totalRange;
    const d = new Date(t);
    labels.push({
      norm,
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    });
  }
  return labels;
}

/* ── Props ── */
interface Props {
  incidents: Incident[];
  repeatedPeople: Set<string>;
  totalIncidents: number;
  mostFrequentPerson: string | null;
}

/* ── Component ── */
const FlowTimeline = ({ incidents, repeatedPeople }: Props) => {
  const navigate = useNavigate();
  const stripRef = useRef<HTMLDivElement>(null);

  const [selection, setSelection] = useState<ActivitySelection | null>(null);

  // Build shared model
  const model = useMemo(() => buildActivityModel(incidents), [incidents]);

  // Insight computed from model + selection
  const insight = useMemo(
    () => model ? computeInsight(model, selection) : null,
    [model, selection],
  );

  // SVG paths
  const curvePath = useMemo(() => model ? buildCurvePath(model) : '', [model]);
  const areaPath = useMemo(() => model ? buildAreaPath(model) : '', [model]);
  const dateLabels = useMemo(() => model ? buildDateLabels(model) : [], [model]);

  // Selection band normalised coords
  const selectionBand = useMemo(() => {
    if (!selection || !model) return null;
    const l = Math.max(0, (selection.startT - model.totalMin) / model.totalRange);
    const r = Math.min(1, (selection.endT - model.totalMin) / model.totalRange);
    return { l, r };
  }, [selection, model]);

  // Handle dot strip group tap
  const handleDotTap = useCallback((group: DotStripGroup) => {
    setSelection(prev => {
      if (prev && prev.startT === group.startT && prev.endT === group.endT) {
        return null; // toggle off
      }
      return {
        startT: group.startT,
        endT: group.endT,
        events: group.events,
      };
    });
  }, []);

  // Handle chart tap — find nearest dot group
  const handleChartClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!model) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * CHART_W;

    // Convert click X to normalised position
    const normClick = (mx - PAD_L) / (CHART_W - PAD_L - PAD_R);
    if (normClick < 0 || normClick > 1) { setSelection(null); return; }

    const clickT = model.totalMin + normClick * model.totalRange;

    // Find nearest dot group
    let best: DotStripGroup | null = null;
    let bestDist = Infinity;
    for (const g of model.dotGroups) {
      const midT = (g.startT + g.endT) / 2;
      const dist = Math.abs(midT - clickT);
      if (dist < bestDist) { bestDist = dist; best = g; }
    }

    if (best && bestDist < model.totalRange * 0.15) {
      setSelection(prev => {
        if (prev && prev.startT === best!.startT && prev.endT === best!.endT) return null;
        return { startT: best!.startT, endT: best!.endT, events: best!.events };
      });
    } else {
      setSelection(null);
    }
  }, [model]);

  // Navigate to incident
  const handleOpenIncident = useCallback((id: string) => {
    navigate(`/incident/${id}`);
  }, [navigate]);

  if (!model || model.events.length === 0) return null;

  const hasEnoughForChart = model.events.length >= 3;

  // Cluster markers on the chart (for clusters with 2+ events)
  const clusterMarkers = model.clusters.filter(c => c.count >= 2);

  return (
    <div className="space-y-4">
      {/* Provenance line */}
      <p className="text-[10px] text-muted-foreground/50 px-1">
        Based on {model.events.length} records between{' '}
        {format(model.events[0].date, 'd MMM yyyy')} and{' '}
        {format(model.events[model.events.length - 1].date, 'd MMM yyyy')}
      </p>

      {/* ─── DENSITY CHART (SVG) ─── */}
      {hasEnoughForChart && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full h-auto cursor-pointer"
            onClick={handleChartClick}
            style={{ touchAction: 'manipulation' }}
          >
            <defs>
              <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            {/* Selection highlight band */}
            {selectionBand && selectionBand.r > selectionBand.l && (
              <>
                <rect
                  x={toX(selectionBand.l)}
                  y={PAD_T}
                  width={toX(selectionBand.r) - toX(selectionBand.l)}
                  height={CHART_H - PAD_T - PAD_B}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.08}
                />
                <line
                  x1={toX(selectionBand.l)} y1={PAD_T}
                  x2={toX(selectionBand.l)} y2={CHART_H - PAD_B}
                  stroke="hsl(var(--primary))" strokeOpacity={0.25}
                  strokeWidth={0.8} strokeDasharray="3 3"
                />
                <line
                  x1={toX(selectionBand.r)} y1={PAD_T}
                  x2={toX(selectionBand.r)} y2={CHART_H - PAD_B}
                  stroke="hsl(var(--primary))" strokeOpacity={0.25}
                  strokeWidth={0.8} strokeDasharray="3 3"
                />
              </>
            )}

            {/* Filled area */}
            <path d={areaPath} fill="url(#activityFill)" />

            {/* Curve line */}
            <path
              d={curvePath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeOpacity={0.6}
            />

            {/* Cluster markers on curve */}
            {clusterMarkers.map((cl, idx) => {
              const norm = (cl.centroidT - model.totalMin) / model.totalRange;
              const cx = toX(norm);
              const cy = toY(densityAt(model.density, norm));
              const r = Math.min(16, 7 + cl.count * 2);
              const isSelected = selection &&
                cl.startT <= selection.endT && cl.endT >= selection.startT;

              return (
                <g key={idx}>
                  {/* Anchor stem */}
                  <line
                    x1={cx} y1={cy - r}
                    x2={cx} y2={cy}
                    stroke="hsl(var(--primary))"
                    strokeOpacity={0.2}
                    strokeWidth={0.8}
                    strokeDasharray="2 2"
                  />
                  {/* Bubble */}
                  <circle
                    cx={cx}
                    cy={cy - r}
                    r={r}
                    fill={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--primary))'}
                    fillOpacity={isSelected ? 0.2 : 0.08}
                    stroke="hsl(var(--primary))"
                    strokeWidth={isSelected ? 1.8 : 1.2}
                    strokeOpacity={isSelected ? 0.8 : 0.5}
                  />
                  {/* Count */}
                  <text
                    x={cx}
                    y={cy - r + 3.5}
                    textAnchor="middle"
                    fontSize={Math.min(11, 8 + cl.count)}
                    fontWeight={600}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.8}
                  >
                    {cl.count}
                  </text>
                </g>
              );
            })}

            {/* Date axis labels */}
            {dateLabels.map((lbl, i) => (
              <text
                key={i}
                x={toX(lbl.norm)}
                y={CHART_H - 4}
                textAnchor="middle"
                fontSize={8}
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.6}
              >
                {lbl.label}
              </text>
            ))}
          </svg>
        </div>
      )}

      {/* ─── DOT STRIP ─── */}
      <div className="px-1">
        <p className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-2">
          Incidents over time
        </p>
        <div
          ref={stripRef}
          className="relative h-[32px] overflow-x-auto scrollbar-hide"
        >
          {/* Baseline */}
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-border" />

          {model.dotGroups.map((group, gi) => {
            const isSelected = selection &&
              group.startT <= selection.endT && group.endT >= selection.startT;
            const dimmed = selection && !isSelected;

            // Position based on normalised centroid
            const leftPct = `${group.centroidNorm * 100}%`;

            if (group.events.length === 1) {
              const ev = group.events[0];
              const color = getColor(ev.category);
              const hasRing = ev.people.some(p => repeatedPeople.has(p));

              return (
                <button
                  key={ev.id}
                  onClick={() => handleDotTap(group)}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{ left: leftPct }}
                  aria-label={`Incident on ${format(ev.date, 'd MMM yyyy')}`}
                >
                  <motion.div
                    className="rounded-full"
                    animate={{
                      width: isSelected ? 14 : 10,
                      height: isSelected ? 14 : 10,
                      opacity: dimmed ? 0.25 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    style={{
                      backgroundColor: color,
                      boxShadow: isSelected
                        ? `0 0 0 3px hsl(var(--background)), 0 0 0 5px ${color}`
                        : hasRing
                          ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${color}`
                          : 'none',
                    }}
                  />
                </button>
              );
            }

            // Group of multiple events
            const primaryColor = getColor(group.events[0].category);

            return (
              <button
                key={`g-${gi}`}
                onClick={() => handleDotTap(group)}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center"
                style={{ left: leftPct }}
                aria-label={`${group.events.length} incidents`}
              >
                <motion.div
                  className="relative flex items-center"
                  animate={{ opacity: dimmed ? 0.25 : 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Stacked dots */}
                  {group.events.slice(0, 4).map((ev, ei) => (
                    <div
                      key={ev.id}
                      className="rounded-full border border-background"
                      style={{
                        width: isSelected ? 12 : 9,
                        height: isSelected ? 12 : 9,
                        backgroundColor: getColor(ev.category),
                        marginLeft: ei === 0 ? 0 : -4,
                        zIndex: group.events.length - ei,
                        boxShadow: isSelected
                          ? `0 0 0 2px hsl(var(--background)), 0 0 0 3px ${primaryColor}`
                          : 'none',
                      }}
                    />
                  ))}
                  {/* Count badge */}
                  {group.events.length >= 3 && (
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-primary-foreground rounded-full flex items-center justify-center"
                      style={{
                        width: 14,
                        height: 14,
                        backgroundColor: 'hsl(var(--primary))',
                      }}
                    >
                      {group.events.length}
                    </span>
                  )}
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── INSIGHT CARD ─── */}
      {insight && (
        <motion.div
          key={insight.title}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className={`rounded-xl px-4 py-3 border ${
            insight.isSelection
              ? 'bg-accent border-accent-foreground/15'
              : 'bg-card border-border'
          }`}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider text-primary/70 mb-1">
            {insight.label}
          </p>
          <p className="text-[13px] font-semibold text-foreground leading-snug">
            {insight.title}
          </p>
          {insight.subtitle && (
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              {insight.subtitle}
            </p>
          )}
        </motion.div>
      )}

      {/* ─── SELECTED INCIDENT CARD ─── */}
      <AnimatePresence>
        {selection && selection.events.length === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border rounded-xl px-4 py-3 shadow-[var(--shadow-card)]"
          >
            {(() => {
              const ev = selection.events[0];
              return (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground/60 block">
                      {format(ev.date, 'dd MMM yyyy')}
                      {ev.incident.incident_time && ` · ${ev.incident.incident_time}`}
                    </span>
                    <p className="text-[13px] font-semibold text-foreground leading-snug mt-0.5 truncate">
                      {ev.incident.title || 'Untitled'}
                    </p>
                    {ev.people.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
                        {ev.people.join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleOpenIncident(ev.id)}
                    className="text-[11px] text-primary font-medium whitespace-nowrap flex-shrink-0 mt-1"
                  >
                    Open →
                  </button>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SELECTED MULTIPLE ─── */}
      <AnimatePresence>
        {selection && selection.events.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border rounded-xl px-4 py-3 shadow-[var(--shadow-card)]"
          >
            <p className="text-[11px] text-muted-foreground/60 mb-1.5">
              {selection.events.length} incidents in this group
            </p>
            <div className="space-y-1.5">
              {selection.events.slice(0, 5).map(ev => (
                <button
                  key={ev.id}
                  onClick={() => handleOpenIncident(ev.id)}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getColor(ev.category) }}
                  />
                  <span className="text-[12px] text-foreground truncate group-hover:text-primary transition-colors">
                    {ev.incident.title || format(ev.date, 'd MMM yyyy')}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 ml-auto flex-shrink-0">
                    {format(ev.date, 'd MMM')}
                  </span>
                </button>
              ))}
              {selection.events.length > 5 && (
                <p className="text-[10px] text-muted-foreground/40">
                  +{selection.events.length - 5} more
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LEGEND ─── */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted-foreground/50">
        {Object.entries(
          model.events.reduce<Record<string, string>>((acc, ev) => {
            if (!acc[ev.category]) acc[ev.category] = getColor(ev.category);
            return acc;
          }, {}),
        )
          .slice(0, 5)
          .map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {cat}
            </span>
          ))}
      </div>
    </div>
  );
};

export default FlowTimeline;
