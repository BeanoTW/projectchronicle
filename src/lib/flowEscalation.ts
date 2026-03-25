import { differenceInDays } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';

export interface EscalationSignal {
  headline: string;
  explanation: string;
}

const WINDOW_DAYS = 14;

/**
 * Return at most ONE escalation signal, by priority:
 * 1. Cluster formation (≥3 within window)
 * 2. Frequency increase
 * 3. Repeated person+category
 * 4. Repeated category
 *
 * sorted: ASC by date, valid dates only, ≥3 records required.
 * Signal must add value beyond the top summary — tighter thresholds.
 */
export function deriveEscalationSignal(
  sorted: Incident[],
  dates: Date[],
): EscalationSignal | null {
  if (sorted.length < 3 || dates.length < 3) return null;

  // 1. Cluster: ≥3 within WINDOW_DAYS (tighter than summary's ≤3 day check)
  const cluster = detectCluster(dates);

  // 2. Frequency increase
  const freqIncrease = detectFrequencyIncrease(dates);

  // 3. Repeated person + category
  const personCat = detectRepeatedPersonCategory(sorted);

  // 4. Repeated category
  const repeatedCat = detectRepeatedCategory(sorted, dates);

  if (cluster) {
    return {
      headline: 'Incidents are occurring close together',
      explanation: 'Multiple events happened within a short period',
    };
  }

  if (freqIncrease) {
    return {
      headline: 'Recent activity is stronger than earlier records',
      explanation: 'More incidents have occurred in a shorter period than before',
    };
  }

  if (personCat) {
    return {
      headline: 'A similar pattern appears repeatedly',
      explanation: 'The same individual and type of incident appear more than once',
    };
  }

  if (repeatedCat) {
    return {
      headline: 'A repeated type of incident is present',
      explanation: 'This category appears multiple times across your records',
    };
  }

  return null;
}

function detectCluster(dates: Date[]): boolean {
  // Require ≥3 within window (stricter than summary)
  for (let i = 0; i < dates.length - 2; i++) {
    const span = differenceInDays(dates[i + 2], dates[i]);
    if (span <= WINDOW_DAYS) return true;
  }
  return false;
}

function detectFrequencyIncrease(dates: Date[]): boolean {
  const last = dates[dates.length - 1];
  const recentStart = new Date(last.getTime() - WINDOW_DAYS * 86400000);
  const prevStart = new Date(recentStart.getTime() - WINDOW_DAYS * 86400000);

  const recentCount = dates.filter(d => d >= recentStart).length;
  const prevCount = dates.filter(d => d >= prevStart && d < recentStart).length;

  return recentCount > prevCount && recentCount >= 2;
}

function detectRepeatedPersonCategory(sorted: Incident[]): boolean {
  const combos: Record<string, number> = {};
  for (const inc of sorted) {
    const cat = inc.category || 'Other';
    for (const person of inc.people_involved) {
      const key = `${person}::${cat}`;
      combos[key] = (combos[key] || 0) + 1;
      if (combos[key] >= 2) return true;
    }
  }
  return false;
}

function detectRepeatedCategory(sorted: Incident[], dates: Date[]): boolean {
  const catCounts: Record<string, number> = {};
  const catDates: Record<string, Date[]> = {};

  sorted.forEach((inc, i) => {
    const cat = inc.category || 'Other';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    if (!catDates[cat]) catDates[cat] = [];
    catDates[cat].push(dates[i]);
  });

  for (const [cat, count] of Object.entries(catCounts)) {
    if (count < 3) continue;
    const d = catDates[cat];
    for (let i = 0; i < d.length - 1; i++) {
      if (differenceInDays(d[i + 1], d[i]) <= 30) return true;
    }
  }
  return false;
}
