import { useMemo } from 'react';
import { parseISO, isValid } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import type { EvidenceFile } from '@/hooks/useEvidence';

/**
 * useInsightsEngine — STRICT FACTUAL MODE.
 *
 * All interpretive / inferred wording has been removed. Outputs are limited to:
 *   - exact deterministic counts (records, categories, people)
 *   - exact date range
 *   - data-completeness gaps (factual: "no attachments", "no witnesses", etc.)
 *
 * No "appears most frequently", "several individuals", "activity increasing",
 * "clustered", "repeated pattern", "stands out", or similar inferred language.
 */

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

export function useInsightsEngine(
  incidents: Incident[],
  allEvidence: EvidenceFile[]
) {
  // Valid-dated records sorted DESC (used by callers for chronology)
  const sorted = useMemo(() => {
    return [...incidents]
      .filter(i => { const d = parseISO(i.incident_date); return isValid(d); })
      .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());
  }, [incidents]);

  // --- People (exact counts, no inference) ---
  const keyIndividuals = useMemo((): PersonEntry[] => {
    const peopleData: Record<string, number> = {};
    incidents.forEach(i => {
      i.people_involved.forEach(p => { peopleData[p] = (peopleData[p] || 0) + 1; });
    });
    const entries = Object.entries(peopleData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return entries.map(([name, count], idx) => ({ name, count, isTop: idx === 0 }));
  }, [incidents]);

  // --- Categories (exact counts, no inference) ---
  const categoryPatterns = useMemo((): CategoryEntry[] => {
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const entries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    return entries.map(([category, count], idx) => ({ category, count, isTop: idx === 0 }));
  }, [incidents]);

  // --- Date range (exact, deterministic) ---
  const dateRange = useMemo(() => {
    if (sorted.length === 0) return null;
    const newest = sorted[0].incident_date;
    const oldest = sorted[sorted.length - 1].incident_date;
    return { oldest, newest };
  }, [sorted]);

  // --- Data gaps (factual completeness, not interpretation) ---
  const dataGaps = useMemo((): DataGap[] => {
    const gaps: DataGap[] = [];
    const noAttach = incidents.filter(i => !allEvidence.some(e => e.incident_id === i.id)).length;
    if (noAttach > 0) gaps.push({ label: 'no attachments', count: noAttach, action: 'Add an attachment', filterKey: 'no-evidence' });
    const noWitness = incidents.filter(i => i.witnesses.length === 0).length;
    if (noWitness > 0) gaps.push({ label: 'no individuals present recorded', count: noWitness, action: 'Add individuals present if available', filterKey: 'no-witnesses' });
    const noExactWords = incidents.filter(i => !i.exact_words).length;
    if (noExactWords > 0) gaps.push({ label: 'no exact wording', count: noExactWords, action: 'Add exact wording if remembered', filterKey: 'no-exact-words' });
    const noImpact = incidents.filter(i => !i.impact_note).length;
    if (noImpact > 0) gaps.push({ label: 'no impact notes', count: noImpact, action: 'Add impact details', filterKey: 'no-impact' });
    return gaps;
  }, [incidents, allEvidence]);

  // --- Summary line: strict counts only ---
  const summaryLine = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Records: ${incidents.length}`);
    if (dateRange) {
      parts.push(`${dateRange.oldest} → ${dateRange.newest}`);
    }
    if (categoryPatterns.length > 0) {
      parts.push(`Categories: ${categoryPatterns.length}`);
    }
    return parts.join(' · ');
  }, [incidents.length, dateRange, categoryPatterns]);

  return {
    sorted,
    summaryLine,
    dateRange,
    keyIndividuals,
    categoryPatterns,
    dataGaps,
    // Legacy fields kept as empty/null so existing consumers don't crash.
    // These intentionally return no interpretive content.
    standoutSignals: [] as Array<{ id: string; headline: string; explanation: string; priority: number }>,
    guidanceHints: [] as Array<{ id: string; text: string }>,
    patternSignals: [] as Array<{ id: string; label: string; explanation: string }>,
    filteredActivityInsights: [] as Array<{ id: string; fact: string; explanation: string }>,
    shouldSuppressPeopleExplanation: false,
    shouldSuppressCategoryExplanation: false,
    recordStrengthInsight: null as { id: string; fact: string; explanation: string } | null,
  };
}
