import { parseISO, isValid, differenceInDays, format } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';

export interface WellnessNarrative {
  paragraphs: string[];
}

/**
 * Generate a calm, grounded wellness narrative based on recorded incidents.
 * No legal advice. No statistics. No names. Just human reflection.
 */
export function generateWellnessNarrative(incidents: Incident[]): WellnessNarrative {
  const valid = incidents
    .filter(i => isValid(parseISO(i.incident_date)) && !i.voided_at)
    .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());

  if (valid.length === 0) return { paragraphs: [] };
  if (valid.length === 1) {
    return {
      paragraphs: [
        'You have one recorded event. This is the beginning of a clear account of what has happened.',
        'Your records are here when you need them.',
      ],
    };
  }

  const paragraphs: string[] = [];

  // --- Opening: grounding ---
  const categories = [...new Set(valid.map(i => i.category).filter(Boolean))];
  const themes = categories.slice(0, 3).map(c => (c || '').toLowerCase());
  if (themes.length > 0) {
    paragraphs.push(
      `A number of interactions and changes have been recorded over time, particularly around ${themes.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
    );
  } else {
    paragraphs.push(
      'A number of events have been recorded over time, covering different situations and interactions.'
    );
  }

  // --- Middle: pattern reflection ---
  const hasClusters = detectClustering(valid);
  const hasLongGaps = detectLongGaps(valid);
  const hasRepeatCategories = categories.length < valid.length * 0.6;

  const middleParts: string[] = [];
  if (hasClusters && hasLongGaps) {
    middleParts.push('Some events occurred close together during certain periods, while others were more spread out.');
  } else if (hasClusters) {
    middleParts.push('Some events occurred close together within certain periods.');
  } else if (hasLongGaps) {
    middleParts.push('Events were generally spaced out, with quieter periods in between.');
  }

  if (hasRepeatCategories) {
    middleParts.push('Similar types of situations appear more than once across your records.');
  }

  if (middleParts.length > 0) {
    paragraphs.push(middleParts.join(' '));
  }

  // --- Personal impact: light, safe ---
  const spanDays = differenceInDays(
    new Date(valid[valid.length - 1].incident_date),
    new Date(valid[0].incident_date)
  );

  if (spanDays > 90 && valid.length >= 5) {
    paragraphs.push(
      'These records may reflect periods where things felt unclear or unsettled, particularly where changes were not fully explained.'
    );
  } else if (valid.length >= 3) {
    paragraphs.push(
      'What you have recorded may reflect a period of change or uncertainty.'
    );
  }

  // --- Closing: steady ---
  paragraphs.push(
    'Taken together, your records form a clear account of events as they were experienced and documented.'
  );

  return { paragraphs };
}

function detectClustering(sorted: Incident[]): boolean {
  for (let i = 0; i < sorted.length - 2; i++) {
    const d1 = new Date(sorted[i].incident_date).getTime();
    const d3 = new Date(sorted[i + 2].incident_date).getTime();
    if (d3 - d1 <= 14 * 86400000) return true;
  }
  return false;
}

function detectLongGaps(sorted: Incident[]): boolean {
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = differenceInDays(
      new Date(sorted[i + 1].incident_date),
      new Date(sorted[i].incident_date)
    );
    if (gap >= 30) return true;
  }
  return false;
}
