/**
 * Sequence Engine — Structure Layer
 *
 * Groups incidents into sequences for readability and export.
 * Sequences are containers only — non-destructive, user-controlled.
 * They NEVER merge narratives, rewrite content, or alter timestamps.
 */

import { parseISO, differenceInHours, format, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';

// ─── Types ────────────────────────────────────────────────────

export interface SequenceSuggestion {
  id: string;
  incident_ids: string[];
  title: string;
  reason: SequenceReason;
  needs_review: boolean;
}

export interface SequenceReason {
  same_date: boolean;
  time_proximity: boolean;
  supporting_signals: string[];
}

export interface ConfirmedSequence {
  id: string;
  incident_ids: string[];
  title: string;
  source: 'system' | 'user';
  created_at: string;
  needs_revalidation?: boolean;
}

export interface SequenceConfig {
  sequences: ConfirmedSequence[];
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────

const TIME_PROXIMITY_HOURS = 4;
const LARGE_SEQUENCE_THRESHOLD = 5;

// ─── Storage (localStorage-backed persistence) ───────────────

const STORAGE_KEY = 'chronicle_sequence_config';

export function loadSequenceConfig(): SequenceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sequences)) return parsed;
    }
  } catch { /* ignore */ }
  return { sequences: [], updated_at: new Date().toISOString() };
}

export function saveSequenceConfig(config: SequenceConfig): void {
  config.updated_at = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ─── Helpers ──────────────────────────────────────────────────

function parseTime(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function sortByDateTime(incidents: Incident[]): Incident[] {
  return [...incidents].sort((a, b) => {
    const dateCompare = a.incident_date.localeCompare(b.incident_date);
    if (dateCompare !== 0) return dateCompare;
    const timeA = parseTime(a.incident_time);
    const timeB = parseTime(b.incident_time);
    if (timeA !== null && timeB !== null) return timeA - timeB;
    if (timeA !== null) return -1;
    if (timeB !== null) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

function generateSequenceId(): string {
  return `seq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatSequenceTitle(date: string, index: number): string {
  try {
    const d = parseISO(date);
    if (!isValid(d)) return `${date} — Grouped records`;
    return index > 0
      ? `${format(d, 'd MMMM yyyy')} — Sequence ${index + 1}`
      : `${format(d, 'd MMMM yyyy')} — Grouped records`;
  } catch {
    return `${date} — Grouped records`;
  }
}

// ─── Sequence Suggestion ──────────────────────────────────────

export function suggestSequences(incidents: Incident[]): SequenceSuggestion[] {
  const active = incidents.filter(i => !i.voided_at);
  if (active.length < 2) return [];

  const sorted = sortByDateTime(active);
  const suggestions: SequenceSuggestion[] = [];
  const assigned = new Set<string>();

  // Group by date first
  const dateGroups: Record<string, Incident[]> = {};
  sorted.forEach(inc => {
    const key = inc.incident_date;
    if (!dateGroups[key]) dateGroups[key] = [];
    dateGroups[key].push(inc);
  });

  // For each date with multiple incidents, check time proximity
  for (const [date, dateIncs] of Object.entries(dateGroups)) {
    if (dateIncs.length < 2) continue;

    // Check if all have times — if so, sub-group by proximity
    const timed = dateIncs.filter(i => parseTime(i.incident_time) !== null);
    const untimed = dateIncs.filter(i => parseTime(i.incident_time) === null);

    if (timed.length >= 2) {
      // Sub-group timed incidents by proximity
      const clusters: Incident[][] = [];
      let currentCluster: Incident[] = [timed[0]];

      for (let i = 1; i < timed.length; i++) {
        const prevTime = parseTime(timed[i - 1].incident_time);
        const currTime = parseTime(timed[i].incident_time);
        if (prevTime !== null && currTime !== null) {
          const diffMinutes = Math.abs(currTime - prevTime);
          if (diffMinutes <= TIME_PROXIMITY_HOURS * 60) {
            currentCluster.push(timed[i]);
          } else {
            if (currentCluster.length >= 2) clusters.push(currentCluster);
            currentCluster = [timed[i]];
          }
        }
      }
      if (currentCluster.length >= 2) clusters.push(currentCluster);

      // Handle untimed incidents on this date
      clusters.forEach((cluster, clusterIdx) => {
        const ids = cluster.map(i => i.id);

        // If untimed incidents exist and there's exactly one cluster, they can join
        if (untimed.length > 0 && clusters.length === 1) {
          untimed.forEach(u => {
            if (!assigned.has(u.id)) {
              ids.push(u.id);
            }
          });
        }

        const supporting: string[] = [];
        const sharedPeople = findSharedPeople(cluster);
        if (sharedPeople.length > 0) supporting.push(`shared individuals: ${sharedPeople.join(', ')}`);

        const needsReview = ids.length > LARGE_SEQUENCE_THRESHOLD;

        suggestions.push({
          id: generateSequenceId(),
          incident_ids: ids,
          title: formatSequenceTitle(date, clusterIdx),
          reason: {
            same_date: true,
            time_proximity: true,
            supporting_signals: supporting,
          },
          needs_review: needsReview,
        });

        ids.forEach(id => assigned.add(id));
      });

      // If no timed clusters formed but we have 2+ same-date, suggest date-only grouping
      if (clusters.length === 0 && dateIncs.length >= 2) {
        const ids = dateIncs.filter(i => !assigned.has(i.id)).map(i => i.id);
        if (ids.length >= 2) {
          suggestions.push({
            id: generateSequenceId(),
            incident_ids: ids,
            title: formatSequenceTitle(date, 0),
            reason: { same_date: true, time_proximity: false, supporting_signals: [] },
            needs_review: ids.length > LARGE_SEQUENCE_THRESHOLD,
          });
          ids.forEach(id => assigned.add(id));
        }
      }
    } else {
      // All untimed or only 1 timed — group by date only
      const ids = dateIncs.filter(i => !assigned.has(i.id)).map(i => i.id);
      if (ids.length >= 2) {
        suggestions.push({
          id: generateSequenceId(),
          incident_ids: ids,
          title: formatSequenceTitle(date, 0),
          reason: { same_date: true, time_proximity: false, supporting_signals: [] },
          needs_review: ids.length > LARGE_SEQUENCE_THRESHOLD,
        });
        ids.forEach(id => assigned.add(id));
      }
    }
  }

  return suggestions;
}

function findSharedPeople(incidents: Incident[]): string[] {
  if (incidents.length < 2) return [];
  const counts: Record<string, number> = {};
  incidents.forEach(i => i.people_involved.forEach(p => {
    counts[p] = (counts[p] || 0) + 1;
  }));
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .map(([name]) => name);
}

// ─── Sequence Management ──────────────────────────────────────

export function confirmSequence(
  config: SequenceConfig,
  suggestion: SequenceSuggestion,
): SequenceConfig {
  const confirmed: ConfirmedSequence = {
    id: suggestion.id,
    incident_ids: [...suggestion.incident_ids],
    title: suggestion.title,
    source: 'system',
    created_at: new Date().toISOString(),
  };
  return {
    ...config,
    sequences: [...config.sequences, confirmed],
  };
}

export function createManualSequence(
  config: SequenceConfig,
  incidentIds: string[],
  incidents: Incident[],
  customTitle?: string,
): SequenceConfig {
  const sorted = sortByDateTime(incidents.filter(i => incidentIds.includes(i.id)));
  const earliestDate = sorted.length > 0 ? sorted[0].incident_date : new Date().toISOString();
  const existingOnDate = config.sequences.filter(s =>
    incidents.some(i => incidentIds.includes(i.id) && i.incident_date === earliestDate)
  ).length;

  const seq: ConfirmedSequence = {
    id: generateSequenceId(),
    incident_ids: [...incidentIds],
    title: customTitle || formatSequenceTitle(earliestDate, existingOnDate),
    source: 'user',
    created_at: new Date().toISOString(),
  };

  return {
    ...config,
    sequences: [...config.sequences, seq],
  };
}

export function removeSequence(config: SequenceConfig, sequenceId: string): SequenceConfig {
  return {
    ...config,
    sequences: config.sequences.filter(s => s.id !== sequenceId),
  };
}

export function updateSequenceTitle(
  config: SequenceConfig,
  sequenceId: string,
  newTitle: string,
): SequenceConfig {
  return {
    ...config,
    sequences: config.sequences.map(s =>
      s.id === sequenceId ? { ...s, title: newTitle } : s
    ),
  };
}

export function addIncidentToSequence(
  config: SequenceConfig,
  sequenceId: string,
  incidentId: string,
): SequenceConfig {
  return {
    ...config,
    sequences: config.sequences.map(s =>
      s.id === sequenceId
        ? { ...s, incident_ids: [...s.incident_ids, incidentId], needs_revalidation: false }
        : s
    ),
  };
}

/** Revalidate sequences after incident changes */
export function revalidateSequences(
  config: SequenceConfig,
  currentIncidentIds: string[],
): SequenceConfig {
  const validIds = new Set(currentIncidentIds);
  return {
    ...config,
    sequences: config.sequences
      .map(s => ({
        ...s,
        incident_ids: s.incident_ids.filter(id => validIds.has(id)),
      }))
      .filter(s => s.incident_ids.length >= 2),
  };
}

// ─── Export Ordering ──────────────────────────────────────────

export interface ExportItem {
  type: 'sequence' | 'standalone';
  sequence?: ConfirmedSequence;
  incidents: Incident[];
  sortKey: string;
}

/**
 * Build ordered export items mixing sequences and standalone incidents.
 * Strict chronological order by earliest incident_date in each group.
 */
export function buildExportItems(
  incidents: Incident[],
  config: SequenceConfig,
): ExportItem[] {
  const active = incidents.filter(i => !i.voided_at);
  const sorted = sortByDateTime(active);
  const sequencedIds = new Set(config.sequences.flatMap(s => s.incident_ids));

  const items: ExportItem[] = [];

  // Add sequences
  config.sequences.forEach(seq => {
    const seqIncidents = sortByDateTime(
      sorted.filter(i => seq.incident_ids.includes(i.id))
    );
    if (seqIncidents.length === 0) return;

    const earliest = seqIncidents[0];
    const sortKey = `${earliest.incident_date}_${earliest.incident_time || '0000'}_${earliest.created_at}`;

    items.push({
      type: 'sequence',
      sequence: seq,
      incidents: seqIncidents,
      sortKey,
    });
  });

  // Add standalone incidents
  sorted.forEach(inc => {
    if (sequencedIds.has(inc.id)) return;
    const sortKey = `${inc.incident_date}_${inc.incident_time || '0000'}_${inc.created_at}`;
    items.push({
      type: 'standalone',
      incidents: [inc],
      sortKey,
    });
  });

  // Sort chronologically
  items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return items;
}

// ─── Integrity Statement ──────────────────────────────────────

export const SEQUENCE_INTEGRITY_STATEMENT =
  'These entries are presented together for readability. Each record was created independently and remains unaltered.';
