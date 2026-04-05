import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import { useFollowUpNotes } from '@/hooks/useFollowUpNotes';
import {
  generateSummary,
  renderSummaryText,
  normaliseIncident,
  sortIncidentsForSummary,
  buildSummaryMetadata,
} from '@/lib/summaryPipeline';
import { getCategoryStyle } from '@/lib/categories';
import CategoryBadge from '@/components/chronicle/CategoryBadge';
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

// ─── Key fact line (deterministic) ────────────────────────────

function buildKeyFactLine(
  incidents: { incident_date: string; people_involved: string[] }[],
): string {
  const dates = incidents
    .map(i => parseISO(i.incident_date))
    .filter(isValid)
    .sort((a, b) => a.getTime() - b.getTime());

  const spanDays = dates.length >= 2 ? differenceInDays(dates[dates.length - 1], dates[0]) : 0;

  const parts: string[] = [];
  parts.push(`${incidents.length} record${incidents.length !== 1 ? 's' : ''}`);
  if (spanDays > 0) parts.push(`Recorded across ${spanDays} days`);

  const peopleCounts: Record<string, number> = {};
  incidents.forEach(i => i.people_involved.forEach(p => {
    peopleCounts[p] = (peopleCounts[p] || 0) + 1;
  }));
  const topPerson = Object.entries(peopleCounts)
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])[0];
  if (topPerson) parts.push(`${topPerson[0]} appears most often`);

  return parts.join(' · ');
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
  const { data: followUpNotes = [] } = useFollowUpNotes();
  const [showSummaryBuilder, setShowSummaryBuilder] = useState(false);

  // Filter out voided
  const activeIncidents = useMemo(
    () => incidents.filter(i => !i.voided_at),
    [incidents],
  );

  // Overview
  const overview = useMemo(() => buildOverview(activeIncidents), [activeIncidents]);

  // Key fact line
  const keyFactLine = useMemo(() => buildKeyFactLine(activeIncidents), [activeIncidents]);

  // Summary (uses RECORD mode via shared pipeline for export parity)
  const summaryResult = useMemo(() => {
    if (activeIncidents.length === 0) return null;
    const allIds = activeIncidents.map(i => i.id);
    return generateSummary({
      incidents: activeIncidents,
      selectedIds: allIds,
      allIncidentCount: activeIncidents.length,
      mode: 'general',
      customPurpose: '',
      options: { includePatterns: true, includeNames: true },
      followUpNotes,
      evidenceFiles: allEvidence,
    });
  }, [activeIncidents, followUpNotes, allEvidence]);

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
        {/* 1. OVERVIEW */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[14px] text-foreground leading-relaxed">{overview}</p>
        </div>

        {/* 2. KEY FACT LINE */}
        <p className="text-[13px] text-muted-foreground font-medium px-1">{keyFactLine}</p>

        {/* 3. SUMMARY */}
        {summaryResult && (
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider px-1">
              Summary
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
                    <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">
                      {section.content}
                    </p>
                  </div>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground/60 px-1 pt-1">
              This record is based on entries made at the time of events and later additions where noted.
            </p>
          </div>
        )}

        {/* 4. PEOPLE INVOLVED */}
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

        {/* 5. INCLUDED INCIDENTS */}
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

              return (
                <button
                  key={inc.id}
                  onClick={() => navigate(`/incident/${inc.id}`)}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] text-muted-foreground font-medium">{dateStr}</span>
                      {inc.category && (
                        <CategoryBadge category={inc.category} subtype={inc.subtype} compact />
                      )}
                    </div>
                    <p className="text-[13px] text-foreground font-medium truncate">
                      {inc.title || inc.ai_summary || inc.raw_narrative?.slice(0, 60)}
                    </p>
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

        {/* 6. EXPORT BLOCK */}
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
              Build a summary
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
