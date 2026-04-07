/**
 * Summary Pipeline v3 — Four-mode deterministic architecture
 *
 * Layer A: Normalisation + metadata derivation (deterministic, reusable)
 * Layer B: Mode-specific formatting (RECORD, PATTERNS, BRIEFING, TRIBUNAL)
 *
 * UI label → mode mapping:
 *   General summary      → PATTERNS
 *   Workplace grievance  → TRIBUNAL
 *   HR discussion        → BRIEFING
 *   Formal complaint     → RECORD (formal tone)
 *   University/education → RECORD (neutral tone)
 *   Personal record      → BRIEFING (simplified tone)
 *   Custom               → user selects mode directly
 *
 * This module is READ-ONLY with respect to incident data.
 */

import { format, parseISO, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import type { FollowUpNote } from '@/hooks/useFollowUpNotes';
import type { EvidenceFile } from '@/hooks/useEvidence';

// ─── Types ────────────────────────────────────────────────────

/** UI-facing mode labels */
export type SummaryMode =
  | 'general'
  | 'workplace-grievance'
  | 'hr-discussion'
  | 'formal-complaint'
  | 'university'
  | 'personal'
  | 'custom';

/** Internal engine modes */
type EngineMode = 'RECORD' | 'PATTERNS' | 'BRIEFING' | 'TRIBUNAL';

/** Tone variant applied within an engine mode */
type ToneVariant = 'formal' | 'neutral' | 'simplified' | 'default';

export interface SummaryModeOption {
  value: SummaryMode;
  label: string;
  description: string;
}

export const SUMMARY_MODE_OPTIONS: SummaryModeOption[] = [
  { value: 'general', label: 'General summary', description: 'Pattern-focused overview of activity and structure' },
  { value: 'workplace-grievance', label: 'Workplace grievance', description: 'Issue-based structure for formal review' },
  { value: 'hr-discussion', label: 'HR discussion', description: 'Concise briefing for discussion' },
  { value: 'formal-complaint', label: 'Formal complaint', description: 'Complete authoritative record' },
  { value: 'university', label: 'University / education', description: 'Neutral institutional record' },
  { value: 'personal', label: 'Personal record', description: 'Simple recap for personal reference' },
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
    const cat = i.category || 'Other';
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

// ─── Mode Mapping ─────────────────────────────────────────────

function resolveEngineMode(mode: SummaryMode, customPurpose: string): { engine: EngineMode; tone: ToneVariant } {
  switch (mode) {
    case 'general':
      return { engine: 'PATTERNS', tone: 'default' };
    case 'workplace-grievance':
      return { engine: 'TRIBUNAL', tone: 'default' };
    case 'hr-discussion':
      return { engine: 'BRIEFING', tone: 'default' };
    case 'formal-complaint':
      return { engine: 'RECORD', tone: 'formal' };
    case 'university':
      return { engine: 'RECORD', tone: 'neutral' };
    case 'personal':
      return { engine: 'BRIEFING', tone: 'simplified' };
    case 'custom':
      if (!customPurpose.trim()) return { engine: 'PATTERNS', tone: 'default' };
      return { engine: 'PATTERNS', tone: 'default' };
    default:
      return { engine: 'PATTERNS', tone: 'default' };
  }
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

function extractFirstSentence(narrative: string): string {
  if (!narrative) return '';
  const match = narrative.match(/^[^.!?]+[.!?]/);
  const sentence = match ? match[0].trim() : narrative.trim();
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

/** Format incident as standard line: [date] — [category] — [person] */
function formatIncidentLine(
  inc: NormalisedIncident,
  includeNames: boolean,
  allPeople: string[],
): string {
  const dateStr = formatDate(inc.incident_date);
  const category = inc.category || 'Other';
  const person = inc.people_involved.length > 0
    ? buildPeopleList(inc.people_involved, includeNames, allPeople)
    : '';
  let line = `${dateStr} — ${category}`;
  if (person) line += ` — ${person}`;
  return line;
}

// ═══════════════════════════════════════════════════════════════
// MODE: RECORD — Complete authoritative record
// ═══════════════════════════════════════════════════════════════

function formatRecord(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
  tone: ToneVariant,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);
  const isFormal = tone === 'formal';

  // Header
  sections.push({
    key: 'header',
    title: isFormal ? 'Formal Complaint — Record of Events' : 'Record of Events',
    content: isFormal
      ? `This document records ${sorted.length} incident${sorted.length !== 1 ? 's' : ''} submitted as part of a formal complaint.`
      : `This document provides a complete record of ${sorted.length} event${sorted.length !== 1 ? 's' : ''} as recorded.`,
  });

  // Overview (count + date range)
  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    sections.push({
      key: 'overview',
      title: 'Overview',
      content: `${sorted.length} incident${sorted.length !== 1 ? 's were' : ' was'} recorded between ${start} and ${end}. Each entry reflects events as documented at the time.`,
    });
  }

  // Category breakdown
  const catEntries = Object.entries(metadata.categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `${cat}: ${count}`);
  if (catEntries.length > 0) {
    sections.push({
      key: 'category-breakdown',
      title: 'Category breakdown',
      content: catEntries.join('\n'),
    });
  }

  // Repeated individuals (with counts)
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = metadata.repeatedIndividuals.map(r => {
      const n = options.includeNames ? r.name : redactName(r.name, allPeople.indexOf(r.name));
      return `${n} (${r.count} incidents)`;
    });
    sections.push({
      key: 'repeated-individuals',
      title: 'Repeated individuals',
      content: names.join('\n'),
    });
  }

  // Full chronology — ALL incidents, appears ONCE only
  if (sorted.length > 0) {
    const entries = sorted.map((inc, idx) => {
      const line = formatIncidentLine(inc, options.includeNames, allPeople);
      const desc = extractFirstSentence(inc.raw_narrative);
      const quote = inc.exact_words ? `\n   Verbatim: "${inc.exact_words}"` : '';
      let entry = `${idx + 1}. ${line}\n   ${desc}${quote}`;
      if (!options.includeNames) entry = redactText(entry, allPeople);
      return entry;
    });
    sections.push({
      key: 'chronology',
      title: 'Full chronology',
      content: entries.join('\n\n'),
    });
  }

  // Record integrity
  sections.push({
    key: 'integrity',
    title: 'Record integrity',
    content: `${metadata.attachmentCoverage} incident${metadata.attachmentCoverage !== 1 ? 's have' : ' has'} supporting attachments. ${metadata.witnessCoverage} incident${metadata.witnessCoverage !== 1 ? 's have' : ' has'} named witnesses.`,
  });

  return sections;
}

// ═══════════════════════════════════════════════════════════════
// MODE: PATTERNS — Reveal structure without narrative
// ═══════════════════════════════════════════════════════════════

function formatPatterns(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
  customPurpose: string,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  // Header
  const purposeLine = customPurpose.trim()
    ? `Prepared for: ${customPurpose}`
    : 'Structural overview of recorded activity.';

  sections.push({
    key: 'header',
    title: 'Pattern Analysis',
    content: purposeLine,
  });

  // Activity distribution — category dominance
  const catEntries = Object.entries(metadata.categoryCounts)
    .sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    const total = sorted.length;
    const lines = catEntries.map(([cat, count]) => {
      const pct = Math.round((count / total) * 100);
      return `• ${cat}: ${count} (${pct}%)`;
    });
    sections.push({
      key: 'activity-distribution',
      title: 'Activity distribution',
      content: lines.join('\n'),
    });
  }

  // Repeated individuals (with counts)
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const lines = metadata.repeatedIndividuals.map(r => {
      const n = options.includeNames ? r.name : redactName(r.name, allPeople.indexOf(r.name));
      return `• ${n}: ${r.count} incidents`;
    });
    sections.push({
      key: 'repeated-individuals',
      title: 'Repeated individuals',
      content: lines.join('\n'),
    });
  }

  // Category overlap — where categories co-occur with same people
  if (metadata.repeatedIndividuals.length > 0 && metadata.repeatedCategories.length > 1 && options.includePatterns) {
    const overlapLines: string[] = [];
    for (const person of metadata.repeatedIndividuals) {
      const personIncs = sorted.filter(i => i.people_involved.includes(person.name));
      const personCats = [...new Set(personIncs.map(i => i.category || 'Other'))];
      if (personCats.length > 1) {
        const pName = options.includeNames ? person.name : redactName(person.name, allPeople.indexOf(person.name));
        overlapLines.push(`• ${pName} appears across: ${personCats.join(', ')}`);
      }
    }
    if (overlapLines.length > 0) {
      sections.push({
        key: 'category-overlap',
        title: 'Category overlap',
        content: overlapLines.join('\n'),
      });
    }
  }

  // Time distribution — clusters or density periods
  if (metadata.frequencyClusters.length > 0 && options.includePatterns) {
    const lines = metadata.frequencyClusters.map(c =>
      `• ${formatDate(c.startDate)} – ${formatDate(c.endDate)}: ${c.count} incidents`
    );
    sections.push({
      key: 'time-distribution',
      title: 'Time distribution',
      content: lines.join('\n'),
    });
  }

  // Escalation structure — sequence of event types only (no interpretation)
  if (sorted.length >= 3 && options.includePatterns) {
    const typeSequence = sorted.map(i => i.category || 'Other');
    // Only show if types change over time
    const uniqueTypes = [...new Set(typeSequence)];
    if (uniqueTypes.length > 1) {
      // Split into thirds for early/mid/late
      const third = Math.ceil(sorted.length / 3);
      const early = sorted.slice(0, third).map(i => i.category || 'Other');
      const mid = sorted.slice(third, third * 2).map(i => i.category || 'Other');
      const late = sorted.slice(third * 2).map(i => i.category || 'Other');

      const earlyCats = [...new Set(early)].join(', ');
      const midCats = [...new Set(mid)].join(', ');
      const lateCats = [...new Set(late)].join(', ');

      sections.push({
        key: 'escalation-structure',
        title: 'Escalation structure',
        content: `Early: ${earlyCats}\nMid: ${midCats}\nLate: ${lateCats}`,
      });
    }
  }

  return sections;
}

// ═══════════════════════════════════════════════════════════════
// MODE: BRIEFING — Human-readable compressed understanding
// ═══════════════════════════════════════════════════════════════

function formatBriefing(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
  tone: ToneVariant,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);
  const isSimplified = tone === 'simplified';

  // Header
  sections.push({
    key: 'header',
    title: isSimplified ? 'Personal Record' : 'Briefing Note',
    content: isSimplified
      ? 'A summary of events as recorded.'
      : `Covering ${sorted.length} recorded incident${sorted.length !== 1 ? 's' : ''}.`,
  });

  // Short summary paragraph
  if (sorted.length > 0) {
    const start = formatDate(metadata.dateRangeStart);
    const end = formatDate(metadata.dateRangeEnd);
    const topCat = metadata.repeatedCategories.length > 0
      ? metadata.repeatedCategories[0].name.toLowerCase()
      : null;
    const catNote = topCat ? `, most frequently involving ${topCat}` : '';

    const summary = isSimplified
      ? `${sorted.length} event${sorted.length !== 1 ? 's were' : ' was'} recorded between ${start} and ${end}${catNote}.`
      : `Between ${start} and ${end}, ${sorted.length} incident${sorted.length !== 1 ? 's were' : ' was'} recorded${catNote}. This briefing provides a compressed overview.`;

    sections.push({
      key: 'summary',
      title: isSimplified ? 'What was recorded' : 'Summary',
      content: summary,
    });
  }

  // Development over time (early → mid → later)
  if (sorted.length >= 3) {
    const third = Math.ceil(sorted.length / 3);
    const earlyIncs = sorted.slice(0, third);
    const midIncs = sorted.slice(third, third * 2);
    const lateIncs = sorted.slice(third * 2);

    const describePhase = (incs: NormalisedIncident[], label: string): string => {
      const cats = [...new Set(incs.map(i => i.category || 'Other'))].join(', ');
      const dateRange = incs.length > 1
        ? `${formatDate(incs[0].incident_date)} – ${formatDate(incs[incs.length - 1].incident_date)}`
        : formatDate(incs[0].incident_date);
      return `${label} (${dateRange}): ${incs.length} event${incs.length !== 1 ? 's' : ''} — ${cats}`;
    };

    const lines = [
      describePhase(earlyIncs, 'Early'),
      describePhase(midIncs, 'Mid'),
      describePhase(lateIncs, 'Later'),
    ];

    sections.push({
      key: 'development',
      title: isSimplified ? 'How things developed' : 'Development over time',
      content: lines.join('\n'),
    });
  }

  // Repetition (people + categories)
  const repLines: string[] = [];
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const names = metadata.repeatedIndividuals.map(r => {
      const n = options.includeNames ? r.name : redactName(r.name, allPeople.indexOf(r.name));
      return `${n} (${r.count})`;
    });
    repLines.push(`People: ${names.join(', ')}`);
  }
  if (metadata.repeatedCategories.length > 0 && options.includePatterns) {
    const cats = metadata.repeatedCategories.map(c => `${c.name} (${c.count})`);
    repLines.push(`Categories: ${cats.join(', ')}`);
  }
  if (repLines.length > 0) {
    sections.push({
      key: 'repetition',
      title: isSimplified ? 'What came up more than once' : 'Repetition',
      content: repLines.join('\n'),
    });
  }

  // Notable features (quotes, clustering, witnesses)
  const notableLines: string[] = [];
  const quotedIncs = sorted.filter(i => i.exact_words);
  if (quotedIncs.length > 0) {
    notableLines.push(`${quotedIncs.length} incident${quotedIncs.length !== 1 ? 's include' : ' includes'} verbatim quotes.`);
  }
  if (metadata.frequencyClusters.length > 0) {
    notableLines.push(`Activity clusters within short timeframes on ${metadata.frequencyClusters.length} occasion${metadata.frequencyClusters.length !== 1 ? 's' : ''}.`);
  }
  if (metadata.witnessCoverage > 0) {
    notableLines.push(`${metadata.witnessCoverage} incident${metadata.witnessCoverage !== 1 ? 's have' : ' has'} named witnesses.`);
  }
  if (metadata.attachmentCoverage > 0) {
    notableLines.push(`${metadata.attachmentCoverage} incident${metadata.attachmentCoverage !== 1 ? 's have' : ' has'} supporting attachments.`);
  }
  if (notableLines.length > 0 && !isSimplified) {
    sections.push({
      key: 'notable',
      title: 'Notable features',
      content: notableLines.join('\n'),
    });
  }

  // Simplified closing
  sections.push({
    key: 'closing',
    title: '',
    content: isSimplified
      ? 'This record reflects events as they were noted at the time.'
      : 'This briefing summarises recorded events for discussion purposes.',
  });

  return sections;
}

// ═══════════════════════════════════════════════════════════════
// MODE: TRIBUNAL — Issue-based grouping for formal review
// ═══════════════════════════════════════════════════════════════

interface IssueGroup {
  issue: string;
  coreIncidents: NormalisedIncident[];
  supportingIncidents: NormalisedIncident[];
}

function deriveIssueGroups(sorted: NormalisedIncident[]): IssueGroup[] {
  // Group by category
  const catMap: Record<string, NormalisedIncident[]> = {};
  sorted.forEach(inc => {
    const cat = inc.category || 'Other';
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(inc);
  });

  // Build issue groups — core = most direct, supporting = contextual
  return Object.entries(catMap)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([issue, incs]) => {
      // For larger groups, select most relevant as core (max 5), rest as supporting
      const core = incs.slice(0, Math.min(5, incs.length));
      const supporting = incs.slice(5);
      return { issue, coreIncidents: core, supportingIncidents: supporting };
    });
}

function formatTribunal(
  sorted: NormalisedIncident[],
  metadata: SummaryMetadata,
  options: SummaryOptions,
): SummarySection[] {
  const sections: SummarySection[] = [];
  const allPeople = collectAllPeople(sorted);

  sections.push({
    key: 'header',
    title: 'Workplace Grievance — Structured Summary',
    content: `This summary groups ${sorted.length} recorded incident${sorted.length !== 1 ? 's' : ''} by issue for review.`,
  });

  // STEP 1+2: Issue groups
  const groups = deriveIssueGroups(sorted);

  groups.forEach((group, gIdx) => {
    const lines: string[] = [];

    // Core incidents (1-2 lines each)
    if (group.coreIncidents.length > 0) {
      lines.push('Core incidents:');
      group.coreIncidents.forEach(inc => {
        let line = formatIncidentLine(inc, options.includeNames, allPeople);
        if (!options.includeNames) line = redactText(line, allPeople);
        lines.push(`  ${line}`);
      });
    }

    // Supporting incidents
    if (group.supportingIncidents.length > 0) {
      lines.push('');
      lines.push('Supporting incidents:');
      group.supportingIncidents.forEach(inc => {
        let line = formatIncidentLine(inc, options.includeNames, allPeople);
        if (!options.includeNames) line = redactText(line, allPeople);
        lines.push(`  ${line}`);
      });
    }

    // Sequence (order only, no causal language)
    if (group.coreIncidents.length >= 2) {
      const first = formatDate(group.coreIncidents[0].incident_date);
      const last = formatDate(group.coreIncidents[group.coreIncidents.length - 1].incident_date);
      lines.push('');
      lines.push(`Sequence: initial event ${first}, followed by subsequent events through ${last}.`);
    }

    // Observed features — factual only (repetition, timing, type)
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
      features.push(`${totalInGroup} events recorded under this issue`);
    }

    if (features.length > 0) {
      lines.push('');
      lines.push('Observed features:');
      features.forEach(f => lines.push(`  • ${f}`));
    }

    sections.push({
      key: `issue-${gIdx}`,
      title: group.issue,
      content: lines.join('\n'),
    });
  });

  // STEP 3: Cross-issue observations
  const crossLines: string[] = [];

  // Repeated individuals across issues
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const crossPeople = metadata.repeatedIndividuals.filter(r => {
      const personIncs = sorted.filter(i => i.people_involved.includes(r.name));
      const personCats = new Set(personIncs.map(i => i.category || 'Other'));
      return personCats.size > 1;
    });
    if (crossPeople.length > 0) {
      crossPeople.forEach(r => {
        const n = options.includeNames ? r.name : redactName(r.name, allPeople.indexOf(r.name));
        const personIncs = sorted.filter(i => i.people_involved.includes(r.name));
        const cats = [...new Set(personIncs.map(i => i.category || 'Other'))];
        crossLines.push(`• ${n} appears across: ${cats.join(', ')}`);
      });
    }
  }

  // Timing relationships between issue groups
  if (metadata.frequencyClusters.length > 0) {
    metadata.frequencyClusters.forEach(c => {
      crossLines.push(`• ${c.count} events clustered between ${formatDate(c.startDate)} and ${formatDate(c.endDate)}`);
    });
  }

  if (crossLines.length > 0) {
    sections.push({
      key: 'cross-issue',
      title: 'Cross-issue observations',
      content: crossLines.join('\n'),
    });
  }

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
  const { engine, tone } = resolveEngineMode(mode, customPurpose);

  switch (engine) {
    case 'RECORD':
      return formatRecord(sorted, metadata, options, tone);
    case 'PATTERNS':
      return formatPatterns(sorted, metadata, options, customPurpose);
    case 'BRIEFING':
      return formatBriefing(sorted, metadata, options, tone);
    case 'TRIBUNAL':
      return formatTribunal(sorted, metadata, options);
    default:
      return formatPatterns(sorted, metadata, options, customPurpose);
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

// ─── TRIBUNAL Export Payload Builder ──────────────────────────
// Bridges V3 TRIBUNAL pipeline output → renderer input contract

import type {
  TribunalExportPayload,
  TribunalIssue,
  TribunalIncidentRef,
  TribunalFollowUp,
} from '@/lib/tribunalRenderer';

export function buildTribunalExportPayload(request: SummaryRequest): TribunalExportPayload | null {
  const { sorted, metadata, options } = buildSummaryPayload({
    ...request,
    mode: 'workplace-grievance',
  });

  if (sorted.length === 0) return null;

  const allPeople = collectAllPeople(sorted);
  const issueGroups = deriveIssueGroups(sorted);

  // Build overview from pipeline header
  const overviewText = `This summary groups ${sorted.length} recorded incident${sorted.length !== 1 ? 's' : ''} by issue for review.`;

  // Map issue groups to renderer contract
  const issues: TribunalIssue[] = issueGroups.map((group, idx) => {
    const mapIncident = (inc: NormalisedIncident): TribunalIncidentRef => {
      const person = inc.people_involved.length > 0
        ? buildPeopleList(inc.people_involved, options.includeNames, allPeople)
        : '';
      const category = inc.category || 'Other';
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

    // Sequence text
    let sequence = '';
    if (group.coreIncidents.length >= 2) {
      const first = formatDate(group.coreIncidents[0].incident_date);
      const last = formatDate(group.coreIncidents[group.coreIncidents.length - 1].incident_date);
      sequence = `Initial event ${first}, followed by subsequent events through ${last}.`;
    }

    // Observed features
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
      features.push(`${totalInGroup} events recorded under this issue`);
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

  // Cross-issue observations
  const crossObservations: string[] = [];
  if (metadata.repeatedIndividuals.length > 0 && options.includePatterns) {
    const crossPeople = metadata.repeatedIndividuals.filter(r => {
      const personIncs = sorted.filter(i => i.people_involved.includes(r.name));
      const personCats = new Set(personIncs.map(i => i.category || 'Other'));
      return personCats.size > 1;
    });
    crossPeople.forEach(r => {
      const n = options.includeNames ? r.name : redactName(r.name, allPeople.indexOf(r.name));
      const personIncs = sorted.filter(i => i.people_involved.includes(r.name));
      const cats = [...new Set(personIncs.map(i => i.category || 'Other'))];
      crossObservations.push(`${n} appears across: ${cats.join(', ')}`);
    });
  }
  if (metadata.frequencyClusters.length > 0) {
    metadata.frequencyClusters.forEach(c => {
      crossObservations.push(`${c.count} events clustered between ${formatDate(c.startDate)} and ${formatDate(c.endDate)}`);
    });
  }

  return {
    overview_text: overviewText,
    issues,
    cross_issue_observations: crossObservations,
    structural_statement: `This document presents ${sorted.length} recorded incident${sorted.length !== 1 ? 's' : ''} grouped by issue category. All content is derived from original records without interpretation.`,
    integrity_statement: 'This record reflects incidents as recorded by the user. Each entry includes an incident date and a recorded timestamp. Updates are appended and do not overwrite original records.',
    export_scope_metadata: {
      total_incidents: metadata.totalIncidentCount,
      selected_incidents: sorted.length,
      date_range_start: metadata.dateRangeStart,
      date_range_end: metadata.dateRangeEnd,
    },
  };
}
