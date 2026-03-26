import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';

export interface NarrativeEntry {
  id: string;
  text: string;
}

export interface NarrativeContext {
  clusterNote: string | null;
  repeatedIndividuals: string[];
  dominantCategory: string | null;
}

export interface TimelineNarrative {
  entries: NarrativeEntry[];
  context: NarrativeContext;
}

/**
 * Generate a factual, neutral, chronological narrative from incident records.
 * No legal advice. No interpretation. Only recorded facts.
 */
export function generateNarrative(incidents: Incident[]): TimelineNarrative {
  // Filter to valid-dated, sort ASC
  const valid = incidents
    .filter(i => isValid(parseISO(i.incident_date)))
    .filter(i => !i.voided_at)
    .sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime());

  // Build entries
  const entries: NarrativeEntry[] = valid.map(inc => {
    const parts: string[] = [];

    // Date
    const dateStr = format(parseISO(inc.incident_date), 'd MMMM yyyy');
    parts.push(`On ${dateStr}`);

    // Time
    if (inc.incident_time) {
      parts[parts.length - 1] += ` at ${inc.incident_time}`;
    }

    // Category
    const category = inc.category ? inc.category.toLowerCase() : 'incident';

    // People
    const people = inc.people_involved.length > 0
      ? ` involving ${inc.people_involved.join(' and ')}`
      : '';

    // Description: use ai_summary (neutral) or first sentence of raw_narrative
    const description = getDescription(inc);

    parts[parts.length - 1] += `, a ${category} was recorded${people}`;

    if (description) {
      parts[parts.length - 1] += `, ${description}`;
    }

    // Ensure ends with period
    let text = parts.join(', ');
    if (!text.endsWith('.')) text += '.';

    return { id: inc.id, text };
  });

  // Context: cluster, repeated individuals, dominant category
  const context = deriveContext(valid);

  return { entries, context };
}

function getDescription(inc: Incident): string | null {
  // Prefer AI summary (already neutral), otherwise first clause of raw narrative
  if (inc.ai_summary) {
    // Take first sentence, lowercase start
    const first = inc.ai_summary.split(/[.!?]/)[0]?.trim();
    if (first) {
      return first.charAt(0).toLowerCase() + first.slice(1);
    }
  }

  if (inc.raw_narrative) {
    const first = inc.raw_narrative.split(/[.!?]/)[0]?.trim();
    if (first && first.length <= 120) {
      return first.charAt(0).toLowerCase() + first.slice(1);
    }
    if (first && first.length > 120) {
      return first.substring(0, 117).trim() + '...';
    }
  }

  return null;
}

function deriveContext(sorted: Incident[]): NarrativeContext {
  let clusterNote: string | null = null;
  const repeatedIndividuals: string[] = [];
  let dominantCategory: string | null = null;

  // Cluster: 3+ within 14 days
  for (let i = 0; i < sorted.length - 2; i++) {
    const d1 = new Date(sorted[i].incident_date).getTime();
    const d3 = new Date(sorted[i + 2].incident_date).getTime();
    if (d3 - d1 <= 14 * 86400000) {
      const startDate = format(parseISO(sorted[i].incident_date), 'd MMMM');
      // Find end of cluster
      let end = i + 2;
      for (let j = i + 3; j < sorted.length; j++) {
        if (new Date(sorted[j].incident_date).getTime() - d1 <= 14 * 86400000) end = j;
        else break;
      }
      const endDate = format(parseISO(sorted[end].incident_date), 'd MMMM yyyy');
      clusterNote = `Between ${startDate} and ${endDate}, multiple incidents were recorded within a short period.`;
      break;
    }
  }

  // Repeated individuals — collapsed to max 2 names
  const peopleCounts: Record<string, number> = {};
  sorted.forEach(i => i.people_involved.forEach(p => {
    peopleCounts[p] = (peopleCounts[p] || 0) + 1;
  }));
  const repeatedEntries = Object.entries(peopleCounts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);
  // Only keep top 2 names to avoid repetitive listing
  repeatedEntries.slice(0, 2).forEach(([name]) => repeatedIndividuals.push(name));

  // Dominant category
  const catCounts: Record<string, number> = {};
  sorted.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] >= 2) {
    dominantCategory = topCat[0];
  }

  return { clusterNote, repeatedIndividuals, dominantCategory };
}
