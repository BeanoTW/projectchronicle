/**
 * Activity Data Model — single source of truth for the Activity screen.
 *
 * Drives: density curve, dot strip, clustering, insight card.
 * Rules: no weighting, no interpretation, count-based only.
 */

import { differenceInDays, parseISO, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';

/* ── Types ── */

export interface ActivityEvent {
  id: string;
  ts: number;          // epoch ms (from incident_date)
  date: Date;
  category: string;
  people: string[];
  incident: Incident;
}

export interface DensitySample {
  t: number;           // epoch ms
  norm: number;        // 0–1 normalised position
  value: number;       // 0–1 normalised density
}

export interface ActivityCluster {
  events: ActivityEvent[];
  count: number;
  centroidT: number;
  startT: number;
  endT: number;
}

export interface DotStripGroup {
  events: ActivityEvent[];
  centroidNorm: number; // 0–1
  startT: number;
  endT: number;
}

export interface ActivitySelection {
  startT: number;
  endT: number;
  events: ActivityEvent[];
}

export interface InsightData {
  label: string;       // e.g. 'Overview' or 'Selected period'
  title: string;
  subtitle: string;
  isSelection: boolean;
}

export interface ActivityModel {
  events: ActivityEvent[];
  totalMin: number;
  totalMax: number;
  totalRange: number;
  density: DensitySample[];
  clusters: ActivityCluster[];
  dotGroups: DotStripGroup[];
}

/* ── Constants ── */

const N_SAMPLES = 120;
const BW_FRACTION = 0.20; // bandwidth = 20% of total range

/* ── Build model from incidents ── */

export function buildActivityModel(incidents: Incident[]): ActivityModel | null {
  const events: ActivityEvent[] = incidents
    .map(inc => {
      const d = parseISO(inc.incident_date);
      if (!isValid(d)) return null;
      return {
        id: inc.id,
        ts: d.getTime(),
        date: d,
        category: inc.category || 'Other',
        people: inc.people_involved || [],
        incident: inc,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.ts - b!.ts) as ActivityEvent[];

  if (events.length === 0) return null;

  const totalMin = events[0].ts;
  const totalMax = events[events.length - 1].ts;
  const totalRange = totalMax - totalMin || 1;
  const bwMs = BW_FRACTION * totalRange;

  // Rolling window density
  const density: DensitySample[] = [];
  let maxDensity = 0;

  for (let i = 0; i < N_SAMPLES; i++) {
    const norm = i / (N_SAMPLES - 1);
    const t = totalMin + norm * totalRange;
    let count = 0;
    for (const e of events) {
      if (Math.abs(e.ts - t) <= bwMs / 2) count++;
    }
    if (count > maxDensity) maxDensity = count;
    density.push({ t, norm, value: count });
  }

  // Normalise
  if (maxDensity > 0) {
    for (const s of density) s.value /= maxDensity;
  }

  // Clustering: single-linkage, threshold = 5% of total range
  const clusterThresh = 0.05 * totalRange;
  const clusters = computeClusters(events, clusterThresh);

  // Dot strip groups: visual proximity on strip (merge events within 2% of range)
  const dotGroupThresh = 0.02 * totalRange;
  const dotGroups = computeDotGroups(events, totalMin, totalRange, dotGroupThresh);

  return { events, totalMin, totalMax, totalRange, density, clusters, dotGroups };
}

/* ── Clustering ── */

function computeClusters(events: ActivityEvent[], thresh: number): ActivityCluster[] {
  if (events.length === 0) return [];

  const clusters: ActivityCluster[] = [];
  let current = [events[0]];

  for (let i = 1; i < events.length; i++) {
    if (events[i].ts - events[i - 1].ts <= thresh) {
      current.push(events[i]);
    } else {
      clusters.push(buildCluster(current));
      current = [events[i]];
    }
  }
  clusters.push(buildCluster(current));
  return clusters;
}

function buildCluster(evs: ActivityEvent[]): ActivityCluster {
  const centroidT = evs.reduce((s, e) => s + e.ts, 0) / evs.length;
  return {
    events: evs,
    count: evs.length,
    centroidT,
    startT: evs[0].ts,
    endT: evs[evs.length - 1].ts,
  };
}

/* ── Dot strip groups ── */

function computeDotGroups(
  events: ActivityEvent[],
  totalMin: number,
  totalRange: number,
  thresh: number,
): DotStripGroup[] {
  if (events.length === 0) return [];

  const groups: DotStripGroup[] = [];
  let current = [events[0]];

  for (let i = 1; i < events.length; i++) {
    if (events[i].ts - events[i - 1].ts <= thresh) {
      current.push(events[i]);
    } else {
      groups.push(buildDotGroup(current, totalMin, totalRange));
      current = [events[i]];
    }
  }
  groups.push(buildDotGroup(current, totalMin, totalRange));
  return groups;
}

function buildDotGroup(evs: ActivityEvent[], totalMin: number, totalRange: number): DotStripGroup {
  const centroidT = evs.reduce((s, e) => s + e.ts, 0) / evs.length;
  return {
    events: evs,
    centroidNorm: (centroidT - totalMin) / totalRange,
    startT: evs[0].ts,
    endT: evs[evs.length - 1].ts,
  };
}

/* ── Density value at a normalised position ── */

export function densityAt(density: DensitySample[], norm: number): number {
  const idx = Math.max(0, Math.min(N_SAMPLES - 1, Math.round(norm * (N_SAMPLES - 1))));
  return density[idx].value;
}

/* ── Insight generation ── */

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysBetween(a: number, b: number): number {
  return Math.round(Math.abs(b - a) / 86400000);
}

export function computeInsight(
  model: ActivityModel,
  selection: ActivitySelection | null,
): InsightData {
  // Selection mode
  if (selection && selection.events.length > 0) {
    const evs = [...selection.events].sort((a, b) => a.ts - b.ts);
    const n = evs.length;
    const spanDays = daysBetween(evs[0].ts, evs[n - 1].ts);

    if (n === 1) {
      return {
        label: 'Selected',
        title: `1 incident recorded on ${fmtDate(evs[0].ts)}`,
        subtitle: evs[0].category,
        isSelection: true,
      };
    }
    if (spanDays === 0) {
      return {
        label: 'Selected',
        title: `${n} incidents recorded on ${fmtDate(evs[0].ts)}`,
        subtitle: 'All on the same day',
        isSelection: true,
      };
    }
    return {
      label: 'Selected period',
      title: `${n} incidents recorded within ${spanDays} day${spanDays !== 1 ? 's' : ''}`,
      subtitle: `${fmtDateShort(evs[0].ts)} – ${fmtDateShort(evs[n - 1].ts)}`,
      isSelection: true,
    };
  }

  // Default: overview insight
  const { events } = model;
  if (events.length === 0) {
    return { label: 'Overview', title: 'No events recorded', subtitle: '', isSelection: false };
  }

  const sorted = events;
  const totalDays = daysBetween(sorted[0].ts, sorted[sorted.length - 1].ts);

  // Densest 14-day window
  let maxCount = 0;
  let bestStart: number | null = null;
  let bestEnd: number | null = null;

  for (const e of sorted) {
    const windowEnd = e.ts + 14 * 86400000;
    const inWindow = sorted.filter(e2 => e2.ts >= e.ts && e2.ts <= windowEnd);
    if (inWindow.length > maxCount) {
      maxCount = inWindow.length;
      bestStart = e.ts;
      bestEnd = Math.min(windowEnd, sorted[sorted.length - 1].ts);
    }
  }

  // Compare last 30 days vs previous 30
  const refT = sorted[sorted.length - 1].ts;
  const last30 = sorted.filter(e => refT - e.ts <= 30 * 86400000).length;
  const prev30 = sorted.filter(e => {
    const age = refT - e.ts;
    return age > 30 * 86400000 && age <= 60 * 86400000;
  }).length;

  if (last30 >= 3 && last30 > prev30) {
    return {
      label: 'Overview',
      title: `${last30} incidents recorded in the last 30 days`,
      subtitle: prev30 > 0
        ? `${prev30} in the 30 days before that`
        : 'Most active period in this record',
      isSelection: false,
    };
  }

  if (maxCount >= 3 && bestStart !== null && bestEnd !== null) {
    const span = daysBetween(bestStart, bestEnd);
    return {
      label: 'Overview',
      title: `${maxCount} incidents recorded within ${span} days`,
      subtitle: `${fmtDateShort(bestStart)} – ${fmtDateShort(bestEnd)} · highest density period`,
      isSelection: false,
    };
  }

  return {
    label: 'Overview',
    title: `${events.length} incidents recorded across ${totalDays} days`,
    subtitle: `${fmtDate(sorted[0].ts)} – ${fmtDate(sorted[sorted.length - 1].ts)}`,
    isSelection: false,
  };
}
