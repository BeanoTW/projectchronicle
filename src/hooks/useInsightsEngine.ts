import { useMemo } from 'react';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import type { EvidenceFile } from '@/hooks/useEvidence';

export interface Insight {
  id: string;
  fact: string;
  explanation: string;
}

export interface StandoutSignal {
  id: string;
  headline: string;
  explanation: string;
  priority: number; // lower = higher priority
}

export interface PersonEntry {
  name: string;
  count: number;
  isTop: boolean;
}

export interface CategoryEntry {
  category: string;
  count: number;
  isTop: boolean;
}

export interface DataGap {
  label: string;
  count: number;
  action: string;
  filterKey: string;
}

export interface PatternSignal {
  id: string;
  label: string;
  explanation: string;
}

export function useInsightsEngine(
  incidents: Incident[],
  allEvidence: EvidenceFile[]
) {
  // Valid-dated records sorted DESC
  const sorted = useMemo(() => {
    return [...incidents]
      .filter(i => { const d = parseISO(i.incident_date); return isValid(d); })
      .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());
  }, [incidents]);

  // Consecutive gaps (DESC: gap[0] = between record 0 and record 1)
  const consecutiveGaps = useMemo(() => {
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      gaps.push(differenceInDays(parseISO(sorted[i].incident_date), parseISO(sorted[i + 1].incident_date)));
    }
    return gaps;
  }, [sorted]);

  // --- Activity insights ---
  const activityInsights = useMemo(() => {
    if (sorted.length < 2) return [] as Insight[];
    const results: Insight[] = [];

    // Clustering: 3+ within 7 days
    const asc = [...sorted].reverse();
    for (let i = 0; i < asc.length - 2; i++) {
      const d1 = new Date(asc[i].incident_date).getTime();
      const d3 = new Date(asc[i + 2].incident_date).getTime();
      if (d3 - d1 <= 7 * 86400000) {
        let count = 3;
        for (let j = i + 3; j < asc.length; j++) {
          if (new Date(asc[j].incident_date).getTime() - d1 <= 7 * 86400000) count++;
          else break;
        }
        results.push({
          id: `cluster-${count}`,
          fact: `${count} records occurred within 7 days`,
          explanation: 'These events occurred in a short time period',
        });
        break;
      }
    }

    // Gap: pick ONE meaningful consecutive gap
    if (consecutiveGaps.length > 0) {
      let chosenGap: { days: number; label: string } | null = null;

      for (let i = 0; i < consecutiveGaps.length; i++) {
        if (consecutiveGaps[i] >= 7) {
          chosenGap = {
            days: consecutiveGaps[i],
            label: i === 0
              ? 'This is the time between your two most recent records'
              : 'This is the longest gap in your records',
          };
          break;
        }
      }

      if (!chosenGap) {
        let largest = { days: 0, idx: -1 };
        for (let i = 0; i < consecutiveGaps.length; i++) {
          if (consecutiveGaps[i] > largest.days) largest = { days: consecutiveGaps[i], idx: i };
        }
        if (largest.days > 0) {
          chosenGap = {
            days: largest.days,
            label: largest.idx === 0
              ? 'This is the time between your two most recent records'
              : 'This is the longest gap in your records',
          };
        }
      }

      if (chosenGap) {
        results.push({
          id: `gap-${chosenGap.days}`,
          fact: `No records for ${chosenGap.days} days`,
          explanation: chosenGap.label,
        });
      }
    }

    // Frequency trend (requires 4+ gaps = 5+ records)
    if (consecutiveGaps.length >= 4) {
      const recentAvg = (consecutiveGaps[0] + consecutiveGaps[1]) / 2;
      const earlierAvg = (consecutiveGaps[2] + consecutiveGaps[3]) / 2;

      if (earlierAvg > 0 && recentAvg <= earlierAvg * 0.75) {
        results.push({
          id: 'freq-increase',
          fact: 'Activity is increasing',
          explanation: 'Entries are occurring closer together over time',
        });
      } else if (recentAvg > 0 && recentAvg >= earlierAvg * 1.25 && earlierAvg > 0) {
        results.push({
          id: 'freq-decrease',
          fact: 'Activity is decreasing',
          explanation: 'Entries are becoming more spread out over time',
        });
      }
    }

    return results;
  }, [sorted, consecutiveGaps]);

  // --- People ---
  const keyIndividuals = useMemo((): PersonEntry[] => {
    const peopleData: Record<string, number> = {};
    incidents.forEach(i => {
      i.people_involved.forEach(p => { peopleData[p] = (peopleData[p] || 0) + 1; });
    });
    const entries = Object.entries(peopleData)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return entries.map(([name, count], idx) => ({ name, count, isTop: idx === 0 }));
  }, [incidents]);

  // --- Categories ---
  const categoryPatterns = useMemo((): CategoryEntry[] => {
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const entries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    return entries.map(([category, count], idx) => ({ category, count, isTop: idx === 0 }));
  }, [incidents]);

  // --- Record strength insight ---
  const recordStrengthInsight = useMemo((): Insight | null => {
    if (incidents.length < 2) return null;
    let weakCount = 0;
    incidents.forEach(i => {
      let missing = 0;
      if (!allEvidence.some(e => e.incident_id === i.id)) missing++;
      if (i.witnesses.length === 0) missing++;
      if (!i.exact_words) missing++;
      if (!i.impact_note) missing++;
      if (missing >= 2) weakCount++;
    });
    if (weakCount > incidents.length / 2) {
      return {
        id: 'record-strength',
        fact: 'Most records have limited supporting detail',
        explanation: 'Adding witnesses, wording, or attachments may strengthen your records',
      };
    }
    return null;
  }, [incidents, allEvidence]);

  // --- "What stands out" (top 2–3 prioritised signals, de-duplicated) ---
  const standoutSignals = useMemo((): StandoutSignal[] => {
    if (incidents.length < 2) return [];
    const signals: StandoutSignal[] = [];
    const usedIds = new Set<string>();

    // 1. Dominant category
    if (categoryPatterns.length > 0 && categoryPatterns[0].count >= 2) {
      const top = categoryPatterns[0];
      signals.push({
        id: 'standout-category',
        headline: `${top.category} appears most frequently`,
        explanation: 'This category appears more than any other in your records',
        priority: 1,
      });
      usedIds.add('category-dominant');
    }

    // 2. Repeated individuals (≥2 people appear multiple times)
    const repeatedPeople = keyIndividuals.filter(p => p.count >= 2);
    if (repeatedPeople.length >= 2) {
      signals.push({
        id: 'standout-people',
        headline: 'Several individuals appear multiple times',
        explanation: 'More than one person is present across multiple entries',
        priority: 2,
      });
      usedIds.add('people-repeated');
    } else if (repeatedPeople.length === 1) {
      signals.push({
        id: 'standout-people',
        headline: `${repeatedPeople[0].name} appears most frequently`,
        explanation: `This individual appears in ${repeatedPeople[0].count} records`,
        priority: 2,
      });
      usedIds.add('people-repeated');
    }

    // 3. Activity pattern
    const clusterInsight = activityInsights.find(i => i.id.startsWith('cluster-'));
    const freqInsight = activityInsights.find(i => i.id.startsWith('freq-'));
    if (clusterInsight) {
      signals.push({
        id: 'standout-activity',
        headline: clusterInsight.fact,
        explanation: clusterInsight.explanation,
        priority: 3,
      });
      usedIds.add(clusterInsight.id);
    } else if (freqInsight) {
      signals.push({
        id: 'standout-activity',
        headline: freqInsight.fact,
        explanation: freqInsight.explanation,
        priority: 3,
      });
      usedIds.add(freqInsight.id);
    }

    // 4. Record strength
    if (recordStrengthInsight && signals.length < 3) {
      signals.push({
        id: 'standout-strength',
        headline: recordStrengthInsight.fact,
        explanation: recordStrengthInsight.explanation,
        priority: 4,
      });
      usedIds.add(recordStrengthInsight.id);
    }

    return signals.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [incidents.length, categoryPatterns, keyIndividuals, activityInsights, recordStrengthInsight]);

  // IDs used in standout (for de-duplication)
  const standoutIds = useMemo(() => {
    const ids = new Set<string>();
    standoutSignals.forEach(s => {
      if (s.id === 'standout-category') ids.add('category-dominant');
      if (s.id === 'standout-people') ids.add('people-repeated');
      if (s.id === 'standout-activity') {
        activityInsights.forEach(i => {
          if (s.headline === i.fact) ids.add(i.id);
        });
      }
      if (s.id === 'standout-strength') ids.add('record-strength');
    });
    return ids;
  }, [standoutSignals, activityInsights]);

  // De-duplicated activity insights
  const filteredActivityInsights = useMemo(() => {
    return activityInsights.filter(i => !standoutIds.has(i.id));
  }, [activityInsights, standoutIds]);

  // De-duplicated people (don't suppress section, just top explanation)
  const shouldSuppressPeopleExplanation = standoutIds.has('people-repeated');

  // De-duplicated category top explanation
  const shouldSuppressCategoryExplanation = standoutIds.has('category-dominant');

  // --- Data gaps ---
  const dataGaps = useMemo((): DataGap[] => {
    const gaps: DataGap[] = [];
    const noAttach = incidents.filter(i => !allEvidence.some(e => e.incident_id === i.id)).length;
    if (noAttach > 0) gaps.push({ label: 'no attachments yet', count: noAttach, action: 'Add an attachment', filterKey: 'no-evidence' });
    const noWitness = incidents.filter(i => i.witnesses.length === 0).length;
    if (noWitness > 0) gaps.push({ label: 'no witnesses', count: noWitness, action: 'Add witnesses if available', filterKey: 'no-witnesses' });
    const noExactWords = incidents.filter(i => !i.exact_words).length;
    if (noExactWords > 0) gaps.push({ label: 'no exact wording', count: noExactWords, action: 'Add exact wording if remembered', filterKey: 'no-exact-words' });
    const noImpact = incidents.filter(i => !i.impact_note).length;
    if (noImpact > 0) gaps.push({ label: 'no impact notes', count: noImpact, action: 'Add impact details', filterKey: 'no-impact' });
    return gaps;
  }, [incidents, allEvidence]);

  // --- Summary line ---
  const summaryLine = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${incidents.length} record${incidents.length !== 1 ? 's' : ''}`);
    const freqInsight = activityInsights.find(i => i.id.startsWith('freq-'));
    if (freqInsight) {
      parts.push(freqInsight.id === 'freq-increase' ? 'Activity increasing' : 'Activity decreasing');
    }
    if (keyIndividuals.length > 0) {
      parts.push(`${keyIndividuals[0].name} appears most`);
    }
    return parts.join(' · ');
  }, [incidents.length, activityInsights, keyIndividuals]);

  return {
    sorted,
    summaryLine,
    standoutSignals,
    filteredActivityInsights,
    keyIndividuals,
    shouldSuppressPeopleExplanation,
    categoryPatterns,
    shouldSuppressCategoryExplanation,
    recordStrengthInsight: standoutIds.has('record-strength') ? null : recordStrengthInsight,
    dataGaps,
  };
}
