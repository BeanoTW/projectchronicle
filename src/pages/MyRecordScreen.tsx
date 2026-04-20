import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import SummaryBuilderModal from '@/components/chronicle/SummaryBuilderModal';
import PageHeader from '@/components/chronicle/PageHeader';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { displayTitle } from '@/lib/displayTitle';
import BoldedTitle from '@/components/chronicle/BoldedTitle';

// ─── Overview generator (deterministic, factual only) ──────
// No interpretive wording (no "most entries relate to", no "repeated involvement").

function buildOverview(
  incidents: { incident_date: string; category?: string | null; people_involved: string[] }[],
): string {
  if (incidents.length === 0) return '';
  const dates = incidents
    .map(i => parseISO(i.incident_date))
    .filter(isValid)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return '';
  if (dates.length === 1) return `1 record on ${format(dates[0], 'd MMM yyyy')}.`;
  const spanDays = differenceInDays(dates[dates.length - 1], dates[0]);
  return `${incidents.length} records between ${format(dates[0], 'd MMM yyyy')} and ${format(dates[dates.length - 1], 'd MMM yyyy')} (${spanDays} day${spanDays === 1 ? '' : 's'}).`;
}

// ─── People involved ─────────────────────────────────────────

interface PersonDisplay {
  name: string;
  count: number;
  lastDate: string;
}

function buildPeopleList(
  incidents: { incident_date: string; people_involved: string[] }[],
): PersonDisplay[] {
  const map: Record<string, { count: number; lastDate: string }> = {};
  incidents.forEach(i => {
    i.people_involved.forEach(p => {
      if (!map[p]) map[p] = { count: 0, lastDate: i.incident_date };
      map[p].count++;
      if (i.incident_date > map[p].lastDate) map[p].lastDate = i.incident_date;
    });
  });
  return Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count || b[1].lastDate.localeCompare(a[1].lastDate))
    .map(([name, d]) => ({ name, count: d.count, lastDate: d.lastDate }));
}

const MyRecordScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();
  const { data: followUpNotes = [] } = useAllFollowUpNotes();
  const [showSummaryBuilder, setShowSummaryBuilder] = useState(false);
  const { maskName, maskEntities } = usePrivacy();

  // Filter out voided
  const activeIncidents = useMemo(
    () => incidents.filter(i => !i.voided_at),
    [incidents],
  );

  // Counts split by record type
  const counts = useMemo(() => {
    const total = activeIncidents.length;
    const dailyCount = activeIncidents.filter(i => (i as any).record_type === 'daily_record').length;
    const incidentCount = total - dailyCount;
    return { total, dailyCount, incidentCount };
  }, [activeIncidents]);

  // Overview
  const overview = useMemo(() => buildOverview(activeIncidents), [activeIncidents]);

  // Record coverage
  const recordCoverage = useMemo(() => {
    if (activeIncidents.length === 0) return null;
    const dates = activeIncidents
      .map(i => parseISO(i.incident_date))
      .filter(isValid)
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return null;
    if (dates.length === 1) {
      return {
        count: 1,
        days: 0,
        earliest: format(dates[0], 'd MMMM yyyy'),
        latest: format(dates[0], 'd MMMM yyyy'),
      };
    }
    const spanDays = differenceInDays(dates[dates.length - 1], dates[0]);
    return {
      count: activeIncidents.length,
      days: spanDays,
      earliest: format(dates[0], 'd MMMM yyyy'),
      latest: format(dates[dates.length - 1], 'd MMMM yyyy'),
    };
  }, [activeIncidents]);

  // People
  const people = useMemo(() => buildPeopleList(activeIncidents), [activeIncidents]);

  // Recent 5 incidents
  const recentIncidents = useMemo(() => {
    return [...activeIncidents]
      .sort((a, b) => b.incident_date.localeCompare(a.incident_date))
      .slice(0, 5);
  }, [activeIncidents]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <p className="text-muted-foreground text-[14px]">Loading...</p>
      </div>
    );
  }

  // Empty state
  if (activeIncidents.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Your record" />
        <div className="px-5 pt-8 text-center">
          <FileText className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[14px] text-muted-foreground">No records have been added yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Your record" />

      <div className="px-5 space-y-4">
        {/* HEADER SUMMARY */}
        {recordCoverage && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-1">
            <p className="text-[12px] font-semibold text-foreground uppercase tracking-wider mb-2">Record coverage</p>
            <div className="text-[13px] text-muted-foreground space-y-0.5">
              <p>Records: {counts.total}</p>
              <p>Incident records: {counts.incidentCount}</p>
              <p>Daily records: {counts.dailyCount}</p>
              {recordCoverage.count === 1 ? (
                <p>On {recordCoverage.earliest}</p>
              ) : (
                <p>Period: {recordCoverage.earliest} → {recordCoverage.latest}</p>
              )}
            </div>
          </div>
        )}

        {/* OVERVIEW (single short line) */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[13px] text-foreground leading-relaxed">{overview}</p>
        </div>

        {/* PEOPLE INVOLVED — collapsed */}
        {people.length > 0 && (
          <details className="bg-card border border-border rounded-xl group">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
              <span className="text-[12px] font-semibold text-foreground uppercase tracking-wider">
                People involved · {people.length}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-border divide-y divide-border">
              {people.slice(0, 3).map(person => (
                <div key={person.name} className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-[13px] font-medium text-foreground">{maskName(person.name)}</p>
                  <p className="text-[12px] text-muted-foreground">Referenced in {person.count} record{person.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
              {people.length > 3 && (
                <details className="group/inner">
                  <summary className="px-4 py-2.5 text-[12px] text-primary font-medium cursor-pointer list-none">
                    + {people.length - 3} more
                  </summary>
                  <div className="divide-y divide-border border-t border-border">
                    {people.slice(3).map(person => (
                      <div key={person.name} className="flex items-center justify-between px-4 py-2.5">
                        <p className="text-[13px] font-medium text-foreground">{maskName(person.name)}</p>
                        <p className="text-[12px] text-muted-foreground">Referenced in {person.count} record{person.count !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </details>
        )}

        {/* RECENT RECORDS — collapsed */}
        <details className="bg-card border border-border rounded-xl group">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
            <span className="text-[12px] font-semibold text-foreground uppercase tracking-wider">
              Recent records · {recentIncidents.length}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t border-border divide-y divide-border">
            {recentIncidents.map(inc => {
              const d = parseISO(inc.incident_date);
              const dateStr = isValid(d) ? format(d, 'd MMM yyyy') : inc.incident_date;
              const isDaily = (inc as any).record_type === 'daily_record';
              return (
                <button
                  key={inc.id}
                  onClick={() => navigate(`/incident/${inc.id}`)}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] truncate leading-relaxed ${isDaily ? 'text-foreground/80' : 'text-foreground'}`}>
                      <BoldedTitle text={maskEntities(displayTitle(inc), inc)} leadingWords={4} />
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground/70">{dateStr}</span>
                      <span className="text-[11px] text-muted-foreground/60">·</span>
                      <span className="text-[11px] text-muted-foreground/70">
                        {isDaily ? 'Daily record' : (inc.category || 'Not sure yet')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                </button>
              );
            })}
            <button
              onClick={() => navigate('/timeline')}
              className="w-full text-center py-2.5 text-[12px] text-primary font-medium hover:bg-muted/30 transition-colors"
            >
              View all records
            </button>
          </div>
        </details>

        {/* INTEGRITY STATEMENT */}
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed px-1">
          This record reflects events as recorded by the user. Each entry includes a date and a recorded timestamp. Updates are appended and do not overwrite original records.
        </p>

        {/* EXPORT BLOCK */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            This record can be turned into a structured document for sharing or review.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/export')}
              className="flex-1 bg-primary text-primary-foreground text-[13px] font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Generate export
            </button>
            <button
              onClick={() => setShowSummaryBuilder(true)}
              className="flex-1 border border-border text-foreground text-[13px] font-medium py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
            >
              Generate structured record
            </button>
          </div>
        </div>
      </div>

      <SummaryBuilderModal
        open={showSummaryBuilder}
        onClose={() => setShowSummaryBuilder(false)}
        incidents={activeIncidents}
      />
    </div>
  );
};

export default MyRecordScreen;
