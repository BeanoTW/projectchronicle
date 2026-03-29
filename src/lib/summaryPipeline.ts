/**
 * Summary Pipeline — Two-layer deterministic architecture
 *
 * Layer A: Normalisation + metadata derivation (deterministic, reusable)
 * Layer B: Mode-specific formatting (presentation only, never mutates data)
 *
 * This module is READ-ONLY with respect to incident data.
 * It never writes back to the database or mutates input.
 */

import { format, parseISO, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import type { FollowUpNote } from '@/hooks/useFollowUpNotes';
import type { EvidenceFile } from '@/hooks/useEvidence';

// ─── Types ────────────────────────────────────────────────────

export type SummaryMode =
  | 'general'
  | 'workplace-grievance'
  | 'hr-discussion'
  | 'formal-complaint'
  | 'university'
  | 'personal'
  | 'custom';

export interface SummaryModeOption {
  value: SummaryMode;
  label: string;
  description: string;
}

export const SUMMARY_MODE_OPTIONS: SummaryModeOption[] = [
  { value: 'general', label: 'General summary', description: 'Default neutral overview' },
  { value: 'workplace-grievance', label: 'Workplace grievance', description: 'Structured workplace narrative' },
  { value: 'hr-discussion', label: 'HR discussion', description: 'Concise discussion brief' },
  { value: 'formal-complaint', label: 'Formal complaint', description: 'Tighter formal complaint summary' },
  { value: 'university', label: 'University / education', description: 'Neutral academic-style summary' },
  { value: 'personal', label: 'Personal record', description: 'Simple direct recap' },
  { value: 'custom', label: 'Custom', description: 'You define the purpose' },
];

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
  const { incidents, selectedIds, allIncidentCount, mode, customPurpose, options, followUpNotes = [], evidenceFiles = [] } = request;

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

  return { sorted, metadata, mode, customPurpose, options };
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

function buildPeopleList(people: string[], includeNames: boolean, allPeople: string[]): string {
  return people
    .map(p => includeNames ? p : redactName(p, allPeople.indexOf(p)))
    .join(' and ');
}

function redactText(text: string, allPeople: string[]): string {
  let result = text;
  allPeople.forEach((person, i) => {
    const regex = new RegExp(person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, `[Individual ${i + 1}]`);
  });
  return result;
}

/** Extract a concise description from a narrative — full first sentence, no truncation */
function extractFirstSentence(narrative: string): string {
  if (!narrative) return '';
  const match = narrative.match(/^[^.!?]+[.!?]/);
  const sentence = match ? match[0].trim() : narrative.trim();
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

// ─── Chronology builders (mode-specific) ──────────────────────

/** General / Custom: numbered chronology with category + first sentence */
function buildNumberedChronology(
  sorted: NormalisedIncident[],
  includeNames: boolean,
  allPeople: string[],
): string[] {
  return sorted.map(inc => {
    const dateStr = formatDate(inc.incident_date);
    const timeStr = inc.incident_time ? ` at ${inc.incident_time}` : '';
    const category = inc.category ? inc.category.toLowerCase() : 'incident';
    let people = '';
    if (inc.people_involved.length > 0) {
      people = ` involving ${buildPeopleList(inc.people_involved, includeNames, allPeople)}`;
    }
    const desc = extractFirstSentence(inc.raw_narrative);
    const descPart = desc ? `, ${desc}` : '';
    let line = `On ${dateStr}${timeStr}, a ${category} was recorded${people}${descPart}`;
    if (!line.endsWith('.')) line += '.';
    if (!includeNames) line = redactText(line, allPeople);
    return line;
  });
}

/** Workplace Grievance: narrative-style entries with fuller context */
function buildGrievanceChronology(
  sorted: NormalisedIncident[],
  includeNames: boolean,
  allPeople: string[],
): string[] {
  return sorted.map(inc => {
    const dateStr = formatDate(inc.incident_date);
    const timeStr = inc.incident_time ? ` at ${inc.incident_time}` : '';
    const locationStr = inc.location ? ` at ${inc.location}` : '';
    let people = '';
    if (inc.people_involved.length > 0) {
      people = `${buildPeopleList(inc.people_involved, includeNames, allPeople)} was involved. `;
    }
    const narrative = inc.raw_narrative || '';
    const desc = extractFirstSentence(narrative);
    const exactQuote = inc.exact_words ? ` The following was recorded verbatim: "${inc.exact_words}"` : '';
    let line = `${dateStr}${timeStr}${locationStr}: ${people}${desc}${exactQuote}`;
    if (!line.endsWith('.')) line += '.';
    if (!includeNames) line = redactText(line, allPeople);
    return line;
  });
}

/** HR Discussion: bullet-style key-point entries */
function buildHRBullets(
  sorted: NormalisedIncident[],
  includeNames: boolean,
  allPeople: string[],
): string[] {
  return sorted.map(inc => {
    const dateStr = formatDate(inc.incident_date);
    const category = inc.category ? inc.category : 'Event';
    let people = '';
    if (inc.people_involved.length > 0) {
      people = ` — ${buildPeopleList(inc.people_involved, includeNames, allPeople)}`;
    }
    const desc = extractFirstSentence(inc.raw_narrative);
    let line = `${dateStr}: ${category}${people}. ${desc}`;
    if (!line.endsWith('.')) line += '.';
    if (!includeNames) line = redactText(line, allPeople);
    return line;
  });
}

/** Personal: date-dash-description, minimal */
function buildPersonalTimeline(
  sorted: NormalisedIncident[],
  includeNames: boolean,
  allPeople: string[],
): string[] {
  return sorted.map(inc => {
    const dateStr = formatDate(inc.incident_date);
    const category = inc.category ? inc.category.toLowerCase() : 'event';
    const desc = extractFirstSentence(inc.raw_narrative);
    let line = `${dateStr} — ${category}${desc ? ': ' + desc : ''}`;
    if (!line.endsWith('.')) line += '.';
    if (!includeNames) line = redactText(line, allPeople);
    return line;
  });
}

// ─── Formatter: General ───────────────────────────────────────

function formatGeneral(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Summary of recorded incidents',
    content: 'Prepared for: general reference',
  });

  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    const cats = metadata.repeatedCategories.map(c => c.name.toLowerCase());
    const catPhrase = cats.length > 0
      ? `, involving ${cats.slice(0, 3).join(', ')}${cats.length > 3 ? ' and other matters' : ''}`
      : '';
    sections.push({
      key: 'overview',
      title: 'Overview',
      content: `This summary outlines ${sorted.length} recorded incident${sorted.length !== 1 ? 's' : ''} between ${start} and ${end}${catPhrase}. The entries reflect events as recorded at the time.`,
    });
  }

  const entries = buildNumberedChronology(sorted, options.includeNames, allPeople);
  if (entries.length > 0) {
    sections.push({
      key: 'chronology',
      title: 'Chronology',
      content: entries.map((e, i) => `${i + 1}. ${e}`).join('\n'),
    });
  }

  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = options.includeNames
      ? metadata.repeatedIndividuals.map(r => r.name).join(', ')
      : metadata.repeatedIndividuals.map((_, i) => `[Individual ${i + 1}]`).join(', ');
    sections.push({
      key: 'repeated-individuals',
      title: 'Repeated individuals',
      content: `The following individual${metadata.repeatedIndividuals.length !== 1 ? 's appear' : ' appears'} across multiple entries: ${names}.`,
    });
  }

  if (metadata.repeatedCategories.length > 0 && options.includePatterns) {
    const catList = metadata.repeatedCategories
      .map(c => `${c.name.toLowerCase()} (${c.count} entries)`)
      .join(', ');
    sections.push({
      key: 'repeated-categories',
      title: 'Recurring themes',
      content: `The following categories recur: ${catList}.`,
    });
  }

  sections.push({
    key: 'closing',
    title: '',
    content: 'This summary reflects recorded entries as documented.',
  });

  return sections;
}

// ─── Formatter: Workplace Grievance ───────────────────────────

function formatWorkplaceGrievance(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Workplace Grievance — Summary of Events',
    content: 'This document outlines a series of recorded workplace incidents for the purpose of a grievance process.',
  });

  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    const workplaceThemes = metadata.repeatedCategories
      .filter(c => ['Management Conduct', 'Pay or Payroll Issue', 'Scheduling or Shift Change', 'Disciplinary Meeting', 'Policy Application'].includes(c.name))
      .map(c => c.name.toLowerCase());
    const themePhrase = workplaceThemes.length > 0
      ? ` The concerns primarily relate to ${workplaceThemes.join(' and ')}.`
      : '';
    sections.push({
      key: 'overview',
      title: 'Overview of concerns',
      content: `Between ${start} and ${end}, ${sorted.length} incident${sorted.length !== 1 ? 's were' : ' was'} recorded relating to workplace conduct and conditions.${themePhrase}`,
    });
  }

  const entries = buildGrievanceChronology(sorted, options.includeNames, allPeople);
  if (entries.length > 0) {
    sections.push({
      key: 'chronology',
      title: 'Chronology of events',
      content: entries.map((e, i) => `${i + 1}. ${e}`).join('\n'),
    });
  }

  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = options.includeNames
      ? metadata.repeatedIndividuals.map(r => `${r.name} (${r.count} incidents)`).join('; ')
      : metadata.repeatedIndividuals.map((r, i) => `[Individual ${i + 1}] (${r.count} incidents)`).join('; ');
    sections.push({
      key: 'repeated-individuals',
      title: 'Individuals involved across incidents',
      content: names,
    });
  }

  if (metadata.repeatedCategories.length > 0 && options.includePatterns) {
    sections.push({
      key: 'workplace-themes',
      title: 'Workplace themes',
      content: metadata.repeatedCategories
        .map(c => `${c.name}: ${c.count} recorded instances`)
        .join('\n'),
    });
  }

  // Impact — only if follow-ups exist
  if (metadata.hasFollowUps) {
    sections.push({
      key: 'impact',
      title: 'Recorded impact',
      content: 'Impact observations have been noted in follow-up entries attached to the relevant incidents.',
    });
  }

  sections.push({
    key: 'closing',
    title: '',
    content: 'This record has been prepared to outline events as they were experienced and recorded.',
  });

  return sections;
}

// ─── Formatter: HR Discussion ─────────────────────────────────

function formatHRDiscussion(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Briefing Note — HR Discussion',
    content: `Covering ${sorted.length} recorded incident${sorted.length !== 1 ? 's' : ''}.`,
  });

  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    sections.push({
      key: 'overview',
      title: 'Summary',
      content: `This briefing covers events recorded between ${start} and ${end} to support an HR discussion.`,
    });
  }

  // Key issues — top categories as bullet list
  if (metadata.repeatedCategories.length > 0 && options.includePatterns) {
    sections.push({
      key: 'key-issues',
      title: 'Key issues',
      content: metadata.repeatedCategories
        .slice(0, 4)
        .map(c => `• ${c.name} (${c.count} occurrences)`)
        .join('\n'),
    });
  }

  // All incidents as HR-style bullets
  const bullets = buildHRBullets(sorted, options.includeNames, allPeople);
  if (bullets.length > 0) {
    sections.push({
      key: 'incidents',
      title: 'Incident log',
      content: bullets.map(b => `• ${b}`).join('\n'),
    });
  }

  // People
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = options.includeNames
      ? metadata.repeatedIndividuals.map(r => r.name).join(', ')
      : metadata.repeatedIndividuals.map((_, i) => `[Individual ${i + 1}]`).join(', ');
    sections.push({
      key: 'people-involved',
      title: 'People involved',
      content: `Recurring across incidents: ${names}.`,
    });
  }

  // Discussion points
  const points: string[] = [];
  if (metadata.frequencyClusters.length > 0) points.push('Events cluster within short timeframes.');
  if (metadata.repeatedIndividuals.length > 0) points.push('The same individuals appear in multiple records.');
  if (metadata.attachmentCoverage > 0) points.push(`${metadata.attachmentCoverage} incident${metadata.attachmentCoverage !== 1 ? 's have' : ' has'} supporting attachments.`);
  if (metadata.witnessCoverage > 0) points.push(`${metadata.witnessCoverage} incident${metadata.witnessCoverage !== 1 ? 's have' : ' has'} named witnesses.`);
  if (points.length > 0) {
    sections.push({
      key: 'discussion-points',
      title: 'Points for discussion',
      content: points.map(p => `• ${p}`).join('\n'),
    });
  }

  sections.push({
    key: 'closing',
    title: '',
    content: 'This summary is intended to support a discussion of recorded events.',
  });

  return sections;
}

// ─── Formatter: Formal Complaint ──────────────────────────────

function formatFormalComplaint(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Formal Complaint — Record of Events',
    content: `This document records ${sorted.length} incident${sorted.length !== 1 ? 's' : ''} submitted as part of a formal complaint.`,
  });

  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    const topCats = metadata.repeatedCategories.slice(0, 2).map(c => c.name.toLowerCase());
    const catPhrase = topCats.length > 0 ? `, primarily concerning ${topCats.join(' and ')}` : '';
    sections.push({
      key: 'summary',
      title: 'Summary',
      content: `Events occurred between ${start} and ${end}${catPhrase}. Each incident was recorded at or near the time it occurred.`,
    });
  }

  // Key incidents — numbered, full chronology
  const entries = buildNumberedChronology(sorted, options.includeNames, allPeople);
  if (entries.length > 0) {
    sections.push({
      key: 'incidents',
      title: 'Recorded incidents',
      content: entries.map((e, i) => `${i + 1}. ${e}`).join('\n'),
    });
  }

  // Repeated conduct
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = options.includeNames
      ? metadata.repeatedIndividuals.map(r => `${r.name} (${r.count})`).join(', ')
      : metadata.repeatedIndividuals.map((r, i) => `[Individual ${i + 1}] (${r.count})`).join(', ');
    sections.push({
      key: 'repeated-conduct',
      title: 'Repeated involvement',
      content: `The following individual${metadata.repeatedIndividuals.length !== 1 ? 's are' : ' is'} named in multiple incidents: ${names}.`,
    });
  }

  // Effect — only when follow-ups contain real notes
  if (metadata.hasFollowUps) {
    sections.push({
      key: 'effect',
      title: 'Effect',
      content: 'The cumulative impact of these events has been noted in follow-up entries where applicable.',
    });
  }

  sections.push({
    key: 'closing',
    title: '',
    content: 'This summary provides a structured account of recorded events for review.',
  });

  return sections;
}

// ─── Formatter: University / Education ────────────────────────

function formatUniversity(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Summary of Recorded Events',
    content: 'Prepared for consideration in an educational or university context.',
  });

  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    sections.push({
      key: 'overview',
      title: 'Overview',
      content: `This summary covers ${sorted.length} recorded event${sorted.length !== 1 ? 's' : ''} between ${start} and ${end}. The events are presented neutrally and chronologically.`,
    });
  }

  // Timeline — numbered entries
  const entries = buildNumberedChronology(sorted, options.includeNames, allPeople);
  if (entries.length > 0) {
    sections.push({
      key: 'timeline',
      title: 'Timeline',
      content: entries.map((e, i) => `${i + 1}. ${e}`).join('\n'),
    });
  }

  if (metadata.repeatedCategories.length > 0 && options.includePatterns) {
    sections.push({
      key: 'recurring-issues',
      title: 'Recurring issues',
      content: metadata.repeatedCategories
        .map(c => `${c.name}: recorded ${c.count} times`)
        .join('\n'),
    });
  }

  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = options.includeNames
      ? metadata.repeatedIndividuals.map(r => r.name).join(', ')
      : metadata.repeatedIndividuals.map((_, i) => `[Individual ${i + 1}]`).join(', ');
    sections.push({
      key: 'individuals',
      title: 'Individuals referenced',
      content: `The following individual${metadata.repeatedIndividuals.length !== 1 ? 's are' : ' is'} referenced in more than one entry: ${names}.`,
    });
  }

  sections.push({
    key: 'closing',
    title: '',
    content: 'This summary provides a chronological account of recorded events for consideration.',
  });

  return sections;
}

// ─── Formatter: Personal Record ───────────────────────────────

function formatPersonal(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Personal Record',
    content: 'A summary of events as recorded.',
  });

  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    sections.push({
      key: 'recap',
      title: 'What was recorded',
      content: `${sorted.length} event${sorted.length !== 1 ? 's were' : ' was'} documented between ${start} and ${end}.`,
    });
  }

  // Simple date-dash timeline
  const entries = buildPersonalTimeline(sorted, options.includeNames, allPeople);
  if (entries.length > 0) {
    sections.push({
      key: 'timeline',
      title: 'Timeline',
      content: entries.join('\n'),
    });
  }

  // Who was involved
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = options.includeNames
      ? metadata.repeatedIndividuals.map(r => r.name).join(', ')
      : metadata.repeatedIndividuals.map((_, i) => `[Individual ${i + 1}]`).join(', ');
    sections.push({
      key: 'who',
      title: 'Who was involved',
      content: names,
    });
  }

  // What repeated
  if (metadata.repeatedCategories.length > 0 && options.includePatterns) {
    sections.push({
      key: 'patterns',
      title: 'What came up more than once',
      content: metadata.repeatedCategories.map(c => c.name).join(', '),
    });
  }

  sections.push({
    key: 'closing',
    title: '',
    content: 'This record reflects events as they were noted at the time.',
  });

  return sections;
}

// ─── Formatter: Custom ────────────────────────────────────────

function formatCustom(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
  customPurpose: string,
): SummarySection[] {
  // Fall back to general if no custom purpose
  if (!customPurpose.trim()) {
    return formatGeneral(sorted, metadata, options);
  }

  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Summary of recorded incidents',
    content: `Prepared for: ${customPurpose}`,
  });

  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    sections.push({
      key: 'overview',
      title: 'Overview',
      content: `This summary covers ${sorted.length} recorded incident${sorted.length !== 1 ? 's' : ''} between ${start} and ${end}.`,
    });
  }

  const entries = buildNumberedChronology(sorted, options.includeNames, allPeople);
  if (entries.length > 0) {
    sections.push({
      key: 'chronology',
      title: 'Chronology',
      content: entries.map((e, i) => `${i + 1}. ${e}`).join('\n'),
    });
  }

  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = options.includeNames
      ? metadata.repeatedIndividuals.map(r => r.name).join(', ')
      : metadata.repeatedIndividuals.map((_, i) => `[Individual ${i + 1}]`).join(', ');
    sections.push({
      key: 'repeated-individuals',
      title: 'Recurring individuals',
      content: names,
    });
  }

  if (metadata.repeatedCategories.length > 0 && options.includePatterns) {
    sections.push({
      key: 'repeated-categories',
      title: 'Recurring themes',
      content: metadata.repeatedCategories.map(c => `${c.name} (${c.count})`).join(', '),
    });
  }

  sections.push({
    key: 'closing',
    title: '',
    content: 'This summary reflects recorded entries as documented.',
  });

  return sections;
}

// ─── Mode Router ──────────────────────────────────────────────

export function formatSummaryByMode(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  mode: SummaryMode,
  customPurpose: string,
  options: SummaryOptions,
): SummarySection[] {
  switch (mode) {
    case 'workplace-grievance':
      return formatWorkplaceGrievance(sorted, metadata, options);
    case 'hr-discussion':
      return formatHRDiscussion(sorted, metadata, options);
    case 'formal-complaint':
      return formatFormalComplaint(sorted, metadata, options);
    case 'university':
      return formatUniversity(sorted, metadata, options);
    case 'personal':
      return formatPersonal(sorted, metadata, options);
    case 'custom':
      return formatCustom(sorted, metadata, options, customPurpose);
    case 'general':
    default:
      return formatGeneral(sorted, metadata, options);
  }
}

// ─── Text Renderer (derived from sections) ────────────────────

export function renderSummaryText(sections: SummarySection[]): string {
  const lines: string[] = [];
  sections.forEach((section, i) => {
    if (i > 0) lines.push('');
    if (section.key === 'header') {
      lines.push(section.title);
      lines.push(section.content);
    } else if (section.key === 'closing') {
      lines.push('---');
      lines.push('');
      lines.push(section.content);
    } else {
      lines.push('---');
      lines.push('');
      if (section.title) lines.push(section.title);
      lines.push('');
      lines.push(section.content);
    }
  });
  return lines.join('\n');
}

// ─── Main Entry Point ─────────────────────────────────────────

export function generateSummary(request: SummaryRequest): SummaryResult {
  const { sorted, metadata, mode, customPurpose, options } = buildSummaryPayload(request);

  const sections = formatSummaryByMode(sorted, metadata, mode, customPurpose, options);
  const renderedText = renderSummaryText(sections);

  return {
    mode,
    selectedIncidentIds: metadata.selectedIncidentIds,
    selectedScope: metadata.selectedScope,
    includeNames: options.includeNames,
    metadata,
    sections,
    renderedText,
  };
}
