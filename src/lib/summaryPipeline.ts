/**
 * Summary Pipeline — Single deterministic structured record output
 *
 * One structure. No modes. No interpretation.
 *
 * This module is READ-ONLY with respect to incident data.
 */

import { format, parseISO, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import type { FollowUpNote } from '@/hooks/useFollowUpNotes';
import type { EvidenceFile } from '@/hooks/useEvidence';

// ─── Types ────────────────────────────────────────────────────

/** @deprecated Kept for backward compatibility — always 'structured-record' */
export type SummaryMode = 'structured-record' | 'general' | 'workplace-grievance' | 'hr-discussion' | 'formal-complaint' | 'university' | 'personal' | 'custom';

export interface SummaryModeOption {
  value: SummaryMode;
  label: string;
  description: string;
}

/** @deprecated No longer used — single mode only */
export const SUMMARY_MODE_OPTIONS: SummaryModeOption[] = [];

export interface NormalisedIncident {
  id: string;
  incident_date: string;
  incident_time: string;
  location: string;
  people_involved: string[];
  witnesses: string[];
  category: string;
  raw_narrative: string;
  exact_words: string;
  follow_up_notes: FollowUpNote[];
  attachment_count: number;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepeatedEntry {
  name: string;
  count: number;
}

export interface FrequencyCluster {
  startDate: string;
  endDate: string;
  count: number;
}

export interface SummaryMetadata {
  totalIncidentCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  latestIncidentDate: string;
  repeatedIndividuals: RepeatedEntry[];
  repeatedCategories: RepeatedEntry[];
  categoryCounts: Record<string, number>;
  attachmentCoverage: number;
  witnessCoverage: number;
  hasFollowUps: boolean;
  frequencyClusters: FrequencyCluster[];
  selectedScope: 'manual' | 'all';
  selectedIncidentIds: string[];
}

export interface SummarySection {
  key: string;
  title: string;
  content: string;
}

export interface SummaryResult {
  mode: SummaryMode;
  selectedIncidentIds: string[];
  selectedScope: 'manual' | 'all';
  includeNames: boolean;
  metadata: SummaryMetadata;
  sections: SummarySection[];
  renderedText: string;
}

export interface SummaryOptions {
  includePatterns: boolean;
  includeNames: boolean;
}

export interface SummaryRequest {
  incidents: Incident[];
  selectedIds: string[];
  allIncidentCount: number;
  mode: SummaryMode;
  customPurpose: string;
  options: SummaryOptions;
  followUpNotes?: FollowUpNote[];
  evidenceFiles?: EvidenceFile[];
}

// ─── Helpers ──────────────────────────────────────────────────

export function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return [];
}

function safeString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

// ─── Layer A: Normalisation ───────────────────────────────────

export function normaliseIncident(
  inc: Incident,
  notes: FollowUpNote[],
  evidenceCount: number,
): NormalisedIncident {
  return {
    id: inc.id,
    incident_date: safeString(inc.incident_date),
    incident_time: safeString(inc.incident_time),
    location: safeString(inc.location),
    people_involved: safeArray(inc.people_involved),
    witnesses: safeArray(inc.witnesses),
    category: safeString(inc.category),
    raw_narrative: safeString(inc.raw_narrative),
    exact_words: safeString(inc.exact_words),
    follow_up_notes: notes,
    attachment_count: typeof evidenceCount === 'number' ? evidenceCount : 0,
    locked: Boolean(inc.locked),
    created_at: safeString(inc.created_at),
    updated_at: safeString(inc.updated_at),
  };
}

export function sortIncidentsForSummary(incidents: NormalisedIncident[]): NormalisedIncident[] {
  return [...incidents].sort((a, b) => {
    const dateCompare = a.incident_date.localeCompare(b.incident_date);
    if (dateCompare !== 0) return dateCompare;
    const timeCompare = a.incident_time.localeCompare(b.incident_time);
    if (timeCompare !== 0) return timeCompare;
    const createdCompare = a.created_at.localeCompare(b.created_at);
    if (createdCompare !== 0) return createdCompare;
    return a.id.localeCompare(b.id);
  });
}

export function deriveRepeatedIndividuals(incidents: NormalisedIncident[]): RepeatedEntry[] {
  const counts: Record<string, number> = {};
  incidents.forEach(i => i.people_involved.forEach(p => {
    counts[p] = (counts[p] || 0) + 1;
  }));
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

export function deriveRepeatedCategories(incidents: NormalisedIncident[]): RepeatedEntry[] {
  const counts: Record<string, number> = {};
  incidents.forEach(i => {
    if (i.category) counts[i.category] = (counts[i.category] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

function deriveCategoryCounts(incidents: NormalisedIncident[]): Record<string, number> {
  const counts: Record<string, number> = {};
  incidents.forEach(i => {
    const cat = i.category || 'Not sure yet';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return counts;
}

export function deriveFrequencyClusters(incidents: NormalisedIncident[]): FrequencyCluster[] {
  if (incidents.length < 2) return [];
  const sorted = sortIncidentsForSummary(incidents);
  const clusters: FrequencyCluster[] = [];
  let clusterStart = 0;

  for (let i = 1; i <= sorted.length; i++) {
    const prevDate = new Date(sorted[i - 1].incident_date).getTime();
    const currDate = i < sorted.length ? new Date(sorted[i].incident_date).getTime() : Infinity;
    if (currDate - prevDate > 14 * 86400000 || i === sorted.length) {
      const clusterSize = i - clusterStart;
      if (clusterSize >= 2) {
        clusters.push({
          startDate: sorted[clusterStart].incident_date,
          endDate: sorted[i - 1].incident_date,
          count: clusterSize,
        });
      }
      clusterStart = i;
    }
  }
  return clusters;
}

export function buildSummaryMetadata(
  normalised: NormalisedIncident[],
  selectedIds: string[],
  allCount: number,
): SummaryMetadata {
  const sorted = sortIncidentsForSummary(normalised);
  const isManual = selectedIds.length < allCount;

  return {
    totalIncidentCount: normalised.length,
    dateRangeStart: sorted.length > 0 ? sorted[0].incident_date : '',
    dateRangeEnd: sorted.length > 0 ? sorted[sorted.length - 1].incident_date : '',
    latestIncidentDate: sorted.length > 0 ? sorted[sorted.length - 1].incident_date : '',
    repeatedIndividuals: deriveRepeatedIndividuals(normalised),
    repeatedCategories: deriveRepeatedCategories(normalised),
    categoryCounts: deriveCategoryCounts(normalised),
    attachmentCoverage: normalised.filter(i => i.attachment_count > 0).length,
    witnessCoverage: normalised.filter(i => i.witnesses.length > 0).length,
    hasFollowUps: normalised.some(i => i.follow_up_notes.length > 0),
    frequencyClusters: deriveFrequencyClusters(normalised),
    selectedScope: isManual ? 'manual' : 'all',
    selectedIncidentIds: selectedIds,
  };
}

// ─── Layer A: Full Payload Builder ────────────────────────────

export function buildSummaryPayload(request: SummaryRequest) {
  const { incidents, selectedIds, allIncidentCount, options, followUpNotes = [], evidenceFiles = [] } = request;

  const selected = incidents.filter(
    i => selectedIds.includes(i.id) && !i.voided_at
  );

  const normalised = selected.map(inc => {
    const notes = followUpNotes.filter(n => n.incident_id === inc.id);
    const evidenceCount = evidenceFiles.filter(e => e.incident_id === inc.id).length;
    return normaliseIncident(inc, notes, evidenceCount);
  });

  const sorted = sortIncidentsForSummary(normalised);
  const metadata = buildSummaryMetadata(sorted, selectedIds, allIncidentCount);

  return { sorted, metadata, options };
}

// ─── Shared formatting helpers ────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'd MMMM yyyy') : dateStr;
  } catch {
    return dateStr;
  }
}

function collectAllPeople(sorted: NormalisedIncident[]): string[] {
  return [...new Set(sorted.flatMap(i => i.people_involved))];
}

function redactName(_name: string, index: number): string {
  return `[Individual ${index + 1}]`;
}

function personRef(name: string, includeNames: boolean, allPeople: string[]): string {
  return includeNames ? name : redactName(name, allPeople.indexOf(name));
}

function buildPeopleList(people: string[], includeNames: boolean, allPeople: string[]): string {
  return people.map(p => personRef(p, includeNames, allPeople)).join(' and ');
}

function redactText(text: string, allPeople: string[]): string {
  let result = text;
  allPeople.forEach((person, i) => {
    const regex = new RegExp(person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, `[Individual ${i + 1}]`);
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════
// SINGLE OUTPUT: Structured Record (deterministic, non-interpretive)
// ═══════════════════════════════════════════════════════════════

function formatStructuredRecord(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  // 1. Header
  sections.push({
    key: 'header',
    title: 'Structured Record',
    content: '',
  });

  // 2. Scope
  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    sections.push({
      key: 'scope',
      title: 'Scope',
      content: `Total records: ${sorted.length}\nDate range: ${start} to ${end}`,
    });
  }

  // 3. Category breakdown (exclude "Not sure yet" from list, include in totals)
  const catEntries = Object.entries(metadata.categoryCounts)
    .filter(([cat]) => cat !== 'Not sure yet')
    .sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    const lines = catEntries.map(([cat, count]) => `${cat}: ${count}`);
    sections.push({
      key: 'category-breakdown',
      title: 'Category breakdown',
      content: lines.join('\n'),
    });
  }

  // 4. People referenced (if enabled, alphabetical)
  if (options.includeNames) {
    const peopleCounts: Record<string, number> = {};
    sorted.forEach(i => i.people_involved.forEach(p => {
      peopleCounts[p] = (peopleCounts[p] || 0) + 1;
    }));
    const entries = Object.entries(peopleCounts)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length > 0) {
      const lines = entries.map(([name, count]) => `${name} appears in ${count} record${count !== 1 ? 's' : ''}`);
      sections.push({
        key: 'people-referenced',
        title: 'People referenced',
        content: lines.join('\n'),
      });
    }
  } else {
    // Redacted people
    const peopleCounts: Record<string, number> = {};
    sorted.forEach(i => i.people_involved.forEach(p => {
      peopleCounts[p] = (peopleCounts[p] || 0) + 1;
    }));
    const entries = Object.entries(peopleCounts)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length > 0) {
      const lines = entries.map(([name, count]) => {
        const redacted = redactName(name, allPeople.indexOf(name));
        return `${redacted} appears in ${count} record${count !== 1 ? 's' : ''}`;
      });
      sections.push({
        key: 'people-referenced',
        title: 'People referenced',
        content: lines.join('\n'),
      });
    }
  }

  // 5. Activity by date range
  if (metadata.frequencyClusters.length > 0 && options.includePatterns) {
    const lines = metadata.frequencyClusters.map(c =>
      `${formatDate(c.startDate)} – ${formatDate(c.endDate)}: ${c.count} records`
    );
    sections.push({
      key: 'activity-by-date',
      title: 'Activity by date range',
      content: lines.join('\n'),
    });
  }

  // 6. Record entries (chronological, no interpretation)
  if (sorted.length > 0) {
    const entries = sorted.map(inc => {
      const dateStr = formatDate(inc.incident_date);
      const category = inc.category || 'Not sure yet';
      const person = inc.people_involved.length > 0
        ? buildPeopleList(inc.people_involved, options.includeNames, allPeople)
        : '';
      let line = `${dateStr} — ${category}`;
      if (person) line += ` — ${person}`;
      if (!options.includeNames) line = redactText(line, allPeople);
      return line;
    });
    sections.push({
      key: 'record-entries',
      title: 'Record entries',
      content: entries.join('\n'),
    });
  }

  return sections;
}

// ─── Text Renderer (derived from sections) ────────────────────

export function renderSummaryText(sections: SummarySection[]): string {
  const lines: string[] = [];
  sections.forEach((section, i) => {
    if (i > 0) lines.push('');
    if (section.key === 'header') {
      lines.push(section.title);
      if (section.content) lines.push(section.content);
    } else {
      lines.push('---');
      lines.push('');
      if (section.title) lines.push(section.title);
      lines.push('');
      if (section.content) lines.push(section.content);
    }
  });
  return lines.join('\n');
}

// ─── Backward-compatible mode router ──────────────────────────

export function formatSummaryByMode(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  _mode: SummaryMode,
  _customPurpose: string,
  options: SummaryOptions,
): SummarySection[] {
  // All modes now produce the same deterministic structured record
  return formatStructuredRecord(sorted, metadata, options);
}

// ─── Main Entry Point ─────────────────────────────────────────

export function generateSummary(request: SummaryRequest): SummaryResult {
  const { sorted, metadata, options } = buildSummaryPayload(request);

  const sections = formatStructuredRecord(sorted, metadata, options);
  const renderedText = renderSummaryText(sections);

  return {
    mode: 'structured-record',
    selectedIncidentIds: metadata.selectedIncidentIds,
    selectedScope: metadata.selectedScope,
    includeNames: options.includeNames,
    metadata,
    sections,
    renderedText,
  };
}

// ─── TRIBUNAL Export Payload Builder ──────────────────────────
// Bridges structured record pipeline → renderer input contract

import type {
  TribunalExportPayload,
  TribunalIssue,
  TribunalIncidentRef,
  TribunalFollowUp,
} from '@/lib/tribunalRenderer';

interface IssueGroup {
  issue: string;
  coreIncidents: NormalisedIncident[];
  supportingIncidents: NormalisedIncident[];
}

function deriveIssueGroups(sorted: NormalisedIncident[]): IssueGroup[] {
  const catMap: Record<string, NormalisedIncident[]> = {};
  sorted.forEach(inc => {
    const cat = inc.category || 'Not sure yet';
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(inc);
  });

  return Object.entries(catMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([issue, incs]) => {
      const core = incs.slice(0, Math.min(5, incs.length));
      const supporting = incs.slice(5);
      return { issue, coreIncidents: core, supportingIncidents: supporting };
    });
}

export function buildTribunalExportPayload(request: SummaryRequest): TribunalExportPayload | null {
  const { sorted, metadata, options } = buildSummaryPayload({
    ...request,
    mode: 'structured-record',
  });

  if (sorted.length === 0) return null;

  const allPeople = collectAllPeople(sorted);
  const issueGroups = deriveIssueGroups(sorted);

  const overviewText = `This document presents ${sorted.length} recorded record${sorted.length !== 1 ? 's' : ''} grouped by category.`;

  const issues: TribunalIssue[] = issueGroups.map((group, idx) => {
    const mapIncident = (inc: NormalisedIncident): TribunalIncidentRef => {
      const person = inc.people_involved.length > 0
        ? buildPeopleList(inc.people_involved, options.includeNames, allPeople)
        : '';
      const category = inc.category || 'Not sure yet';
      let summary = `${category}`;
      if (person) summary += ` — ${person}`;
      if (!options.includeNames) summary = redactText(summary, allPeople);

      const followUps: TribunalFollowUp[] = inc.follow_up_notes.map(n => ({
        follow_up_id: n.id,
        created_at: n.created_at,
        note_text: options.includeNames ? n.note_text : redactText(n.note_text, allPeople),
      }));

      return {
        incident_id: inc.id,
        incident_date: inc.incident_date,
        incident_time: inc.incident_time || undefined,
        short_structured_summary: summary,
        follow_ups: followUps,
      };
    };

    let sequence = '';
    if (group.coreIncidents.length >= 2) {
      const first = formatDate(group.coreIncidents[0].incident_date);
      const last = formatDate(group.coreIncidents[group.coreIncidents.length - 1].incident_date);
      sequence = `Initial event ${first}, followed by subsequent events through ${last}.`;
    }

    const features: string[] = [];
    const peopleInGroup = group.coreIncidents.flatMap(i => i.people_involved);
    const peopleCounts: Record<string, number> = {};
    peopleInGroup.forEach(p => { peopleCounts[p] = (peopleCounts[p] || 0) + 1; });
    const repeatedInGroup = Object.entries(peopleCounts)
      .filter(([, c]) => c >= 2)
      .map(([name]) => personRef(name, options.includeNames, allPeople));
    if (repeatedInGroup.length > 0) {
      features.push(`Repeated involvement: ${repeatedInGroup.join(', ')}`);
    }
    const totalInGroup = group.coreIncidents.length + group.supportingIncidents.length;
    if (totalInGroup >= 3) {
      features.push(`${totalInGroup} records under this category`);
    }

    return {
      issue_title: group.issue,
      core_incidents: group.coreIncidents.map(mapIncident),
      supporting_incidents: group.supportingIncidents.map(mapIncident),
      sequence,
      observed_features: features,
      comparator_contrast: [],
      display_order: idx,
    };
  });

  const crossObservations: string[] = [];
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const crossPeople = metadata.repeatedIndividuals.filter(r => {
      const personIncs = sorted.filter(i => i.people_involved.includes(r.name));
      const personCats = new Set(personIncs.map(i => i.category || 'Not sure yet'));
      return personCats.size > 1;
    });
    crossPeople.forEach(r => {
      const n = options.includeNames ? r.name : redactName(r.name, allPeople.indexOf(r.name));
      const personIncs = sorted.filter(i => i.people_involved.includes(r.name));
      const cats = [...new Set(personIncs.map(i => i.category || 'Not sure yet'))];
      crossObservations.push(`${n} appears across: ${cats.join(', ')}`);
    });
  }
  if (metadata.frequencyClusters.length > 0) {
    metadata.frequencyClusters.forEach(c => {
      crossObservations.push(`${c.count} records between ${formatDate(c.startDate)} and ${formatDate(c.endDate)}`);
    });
  }

  return {
    overview_text: overviewText,
    issues,
    cross_issue_observations: crossObservations,
    structural_statement: `This document presents ${sorted.length} recorded record${sorted.length !== 1 ? 's' : ''} grouped by category. All content is derived from original records without interpretation.`,
    integrity_statement: 'This record reflects events as recorded by the user. Each entry includes a date and a recorded timestamp. Updates are appended and do not overwrite original records.',
    export_scope_metadata: {
      total_incidents: metadata.totalIncidentCount,
      selected_incidents: sorted.length,
      date_range_start: metadata.dateRangeStart,
      date_range_end: metadata.dateRangeEnd,
    },
  };
}
