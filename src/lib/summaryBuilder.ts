import { format, parseISO, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';

export type SummaryContext =
  | 'workplace-grievance'
  | 'hr-discussion'
  | 'formal-complaint'
  | 'university'
  | 'personal'
  | 'general'
  | 'custom';

export interface SummaryContextOption {
  value: SummaryContext;
  label: string;
  description: string;
}

export const CONTEXT_OPTIONS: SummaryContextOption[] = [
  { value: 'workplace-grievance', label: 'Workplace grievance', description: 'Structured, formal-neutral tone' },
  { value: 'hr-discussion', label: 'HR discussion', description: 'Conversational-professional tone' },
  { value: 'formal-complaint', label: 'Formal complaint', description: 'Structured, concise tone' },
  { value: 'university', label: 'University / education', description: 'Neutral-academic tone' },
  { value: 'personal', label: 'Personal record', description: 'Simple, direct tone' },
  { value: 'general', label: 'General summary', description: 'Default neutral tone' },
  { value: 'custom', label: 'Custom', description: 'You define the purpose' },
];

const CONTEXT_LABELS: Record<SummaryContext, string> = {
  'workplace-grievance': 'workplace grievance process',
  'hr-discussion': 'HR discussion',
  'formal-complaint': 'formal complaint',
  'university': 'university / education matter',
  'personal': 'personal records',
  'general': 'general reference',
  'custom': 'stated purpose',
};

const CLOSING_LINES: Record<SummaryContext, string> = {
  'workplace-grievance': 'This record has been prepared to outline events as they were experienced and recorded.',
  'hr-discussion': 'This summary is intended to support a discussion of recorded events.',
  'formal-complaint': 'This summary provides a structured account of recorded events for review.',
  'university': 'This summary provides a chronological account of recorded events for consideration.',
  'personal': 'This record reflects events as they were noted at the time.',
  'general': 'This summary reflects recorded entries as documented.',
  'custom': 'This summary reflects recorded entries as documented.',
};

export interface SummaryOptions {
  includePatterns: boolean;
  includeNames: boolean;
}

export interface GeneratedSummary {
  header: string;
  overview: string;
  entries: string[];
  patterns: string[];
  closing: string;
  fullText: string;
}

function cleanDescription(inc: Incident): string {
  const source = inc.ai_summary || inc.raw_narrative;
  if (!source) return '';
  const first = source.split(/[.!?]/)[0]?.trim();
  if (!first) return '';
  const cleaned = first.charAt(0).toLowerCase() + first.slice(1);
  return cleaned.length > 120 ? cleaned.substring(0, 117).trim() + '...' : cleaned;
}

function redactNames(text: string, people: string[]): string {
  let result = text;
  people.forEach((person, i) => {
    const regex = new RegExp(person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, `[Individual ${i + 1}]`);
  });
  return result;
}

export function buildSummary(
  incidents: Incident[],
  context: SummaryContext,
  customLabel: string,
  options: SummaryOptions
): GeneratedSummary {
  // Filter valid, non-voided, sort chronologically
  const valid = incidents
    .filter(i => isValid(parseISO(i.incident_date)) && !i.voided_at)
    .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());

  // Collect all people for potential redaction
  const allPeople = [...new Set(valid.flatMap(i => i.people_involved))];

  const contextLabel = context === 'custom' && customLabel
    ? customLabel
    : CONTEXT_LABELS[context];

  // Header
  const header = `Summary of recorded incidents\nPrepared for: ${contextLabel}`;

  // Overview
  let overview = '';
  if (valid.length > 0) {
    const startDate = format(parseISO(valid[0].incident_date), 'd MMMM yyyy');
    const endDate = format(parseISO(valid[valid.length - 1].incident_date), 'd MMMM yyyy');
    const categories = [...new Set(valid.map(i => i.category).filter(Boolean))];
    const catPhrase = categories.length > 0
      ? `, involving ${categories.slice(0, 3).join(', ').toLowerCase()}${categories.length > 3 ? ' and other matters' : ''}`
      : '';
    overview = `This summary outlines ${valid.length} recorded incident${valid.length !== 1 ? 's' : ''} between ${startDate} and ${endDate}${catPhrase}. The entries reflect events as recorded at the time.`;
  }

  // Chronological entries
  const entries = valid.map(inc => {
    const dateStr = format(parseISO(inc.incident_date), 'd MMMM yyyy');
    const timeStr = inc.incident_time ? ` at ${inc.incident_time}` : '';
    const category = inc.category ? inc.category.toLowerCase() : 'incident';

    let people = '';
    if (inc.people_involved.length > 0) {
      const names = options.includeNames
        ? inc.people_involved.join(' and ')
        : inc.people_involved.map((_, i) => `[Individual ${i + 1}]`).join(' and ');
      people = ` involving ${names}`;
    }

    const desc = cleanDescription(inc);
    const descPart = desc ? `, ${desc}` : '';

    let line = `On ${dateStr}${timeStr}, a ${category} was recorded${people}${descPart}.`;

    if (!options.includeNames) {
      line = redactNames(line, allPeople);
    }

    return line;
  });

  // Pattern summary
  const patterns: string[] = [];
  if (options.includePatterns && valid.length >= 2) {
    // Repeated person
    const peopleCounts: Record<string, number> = {};
    valid.forEach(i => i.people_involved.forEach(p => {
      peopleCounts[p] = (peopleCounts[p] || 0) + 1;
    }));
    const repeatedPeople = Object.entries(peopleCounts).filter(([, c]) => c >= 2);
    if (repeatedPeople.length > 0) {
      patterns.push('Several incidents involve the same individual.');
    }

    // Repeated category
    const catCounts: Record<string, number> = {};
    valid.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCat && topCat[1] >= 3) {
      patterns.push(`Multiple incidents relate to ${topCat[0].toLowerCase()}.`);
    }

    // Clustering
    for (let i = 0; i < valid.length - 1; i++) {
      const d1 = new Date(valid[i].incident_date).getTime();
      const d2 = new Date(valid[i + 1].incident_date).getTime();
      if (d2 - d1 <= 7 * 86400000) {
        patterns.push('Some events occurred within a short period.');
        break;
      }
    }

    // Cap at 3
    patterns.splice(3);
  }

  // Closing
  const closing = CLOSING_LINES[context];

  // Full text assembly
  const sections: string[] = [header, '', overview];
  if (entries.length > 0) {
    sections.push('', '---', '');
    entries.forEach((e, i) => sections.push(`${i + 1}. ${e}`));
  }
  if (patterns.length > 0) {
    sections.push('', '---', '');
    patterns.forEach(p => sections.push(`• ${p}`));
  }
  sections.push('', '---', '', closing);

  return {
    header,
    overview,
    entries,
    patterns,
    closing,
    fullText: sections.join('\n'),
  };
}
