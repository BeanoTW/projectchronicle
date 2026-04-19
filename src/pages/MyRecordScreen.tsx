import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import {
  generateSummary,
} from '@/lib/summaryPipeline';
import { CategoryLabel } from '@/components/chronicle/CategoryBadge';
import SummaryBuilderModal from '@/components/chronicle/SummaryBuilderModal';
import PageHeader from '@/components/chronicle/PageHeader';

// ─── Overview generator (deterministic, template-locked) ──────

function buildOverview(
  incidents: { incident_date: string; category?: string | null; people_involved: string[] }[],
): string {
  if (incidents.length === 0) return '';

  const dates = incidents
    .map(i => parseISO(i.incident_date))
    .filter(isValid)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length < 2) return 'Records have been made covering a single incident.';

  const spanDays = differenceInDays(dates[dates.length - 1], dates[0]);
  const timeSpan = spanDays <= 30 ? `${spanDays} days` : `${Math.floor(spanDays / 30)} months`;

  // Repeated individuals (>1 appearance)
  const peopleCounts: Record<string, number> = {};
  incidents.forEach(i => i.people_involved.forEach(p => {
    peopleCounts[p] = (peopleCounts[p] || 0) + 1;
  }));
  const topPerson = Object.entries(peopleCounts)
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])[0];

  // Dominant category (≥40%)
  const catCounts: Record<string, number> = {};
  incidents.forEach(i => {
    if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  const hasDominant = topCat && topCat[1] >= incidents.length * 0.4;

  if (topPerson && hasDominant) {
    return `Records have been made over ${timeSpan}, with repeated involvement from ${topPerson[0]}. Most entries relate to ${topCat[0]}.`;
  }
  return `Records have been made over ${timeSpan}, covering multiple incidents across this period.`;
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

      <div className="px-5 space-y-5">
        {/* RECORD COVERAGE */}
        {recordCoverage && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[12px] font-semibold text-foreground uppercase tracking-wider mb-2">Record coverage</p>
            {recordCoverage.count === 1 ? (
              <p className="text-[13px] text-muted-foreground">
                1 record{'\n'}On {recordCoverage.earliest}
              </p>
            ) : (
              <div className="text-[13px] text-muted-foreground space-y-0.5">
                <p>{recordCoverage.count} records</p>
                <p>Across {recordCoverage.days} days</p>
                <p>Covering {recordCoverage.earliest} to {recordCoverage.latest}</p>
              </div>
            )}
          </div>
        )}

        {/* OVERVIEW */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[14px] text-foreground leading-relaxed">{overview}</p>
        </div>

        {/* STRUCTURED RECORD */}
        {summaryResult && (
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider px-1">
              Data overview
            </h2>
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              {summaryResult.sections
                .filter(s => s.key !== 'header')
                .map(section => (
                  <div key={section.key}>
                    {section.title && (
                      <p className="text-[13px] font-semibold text-foreground mb-1">
                        {section.title}
                      </p>
                    )}
                    {section.content && (
                      <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">
                        {section.content}
                      </p>
                    )}
                  </div>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground/60 px-1 pt-1">
              This record is based on entries made at the time of events and later additions where noted.
            </p>
          </div>
        )}

        {/* PEOPLE INVOLVED */}
        {people.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider px-1">
              People involved
            </h2>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {people.slice(0, 8).map((person, idx) => (
                <div
                  key={person.name}
                  className={`flex items-center justify-between px-4 py-3 ${idx < 3 ? '' : 'opacity-70'}`}
                >
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{person.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      Appears in {person.count} record{person.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {idx < 3 && (
                    <Users className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECENT RECORDS */}
        <div className="space-y-1">
          <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider px-1">
            Recent records
          </h2>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {recentIncidents.map(inc => {
              const d = parseISO(inc.incident_date);
              const dateStr = isValid(d) ? format(d, 'd MMM yyyy') : inc.incident_date;
              const hasAttachments = allEvidence.some(e => e.incident_id === inc.id);
              const hasFollowUps = followUpNotes.some(n => n.incident_id === inc.id);
              const categoryDisplay = inc.category || 'Unclassified';

              return (
                <button
                  key={inc.id}
                  onClick={() => navigate(`/incident/${inc.id}`)}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <CategoryLabel category={categoryDisplay} subtype={inc.subtype ?? undefined} />
                    <p className="text-[13px] text-foreground font-medium truncate mt-0.5">
                      {inc.title || inc.ai_summary || inc.raw_narrative?.slice(0, 60)}
                    </p>
                    <span className="text-[11px] text-muted-foreground/60">{dateStr}</span>
                    {(hasAttachments || hasFollowUps) && (
                      <div className="flex gap-2 mt-0.5">
                        {hasAttachments && (
                          <span className="text-[11px] text-muted-foreground/60">📎 Attachment</span>
                        )}
                        {hasFollowUps && (
                          <span className="text-[11px] text-muted-foreground/60">＋ Follow-up</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

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
