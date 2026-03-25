import { useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { MapPin, User, Paperclip, StickyNote, ChevronRight } from 'lucide-react';
import type { Incident } from '@/hooks/useIncidents';
import CategoryBadge from './CategoryBadge';

interface Props {
  incidents: Incident[];
  isPartOfPattern: (inc: Incident) => boolean;
  evidenceCounts?: Record<string, number>;
  noteCounts?: Record<string, number>;
  occurrenceLabel?: (inc: Incident) => string | null;
}

const ChronologyTimeline = ({ incidents, isPartOfPattern, evidenceCounts = {}, noteCounts = {}, occurrenceLabel }: Props) => {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const groups: { label: string; items: Incident[] }[] = [];
    let currentMonth = '';
    incidents.forEach(inc => {
      const month = format(parseISO(inc.incident_date), 'MMMM yyyy');
      if (month !== currentMonth) {
        groups.push({ label: month, items: [] });
        currentMonth = month;
      }
      groups[groups.length - 1].items.push(inc);
    });
    return groups;
  }, [incidents]);

  const summary = useMemo(() => {
    const peopleCounts: Record<string, number> = {};
    incidents.forEach(i => i.people_involved.forEach(p => {
      peopleCounts[p] = (peopleCounts[p] || 0) + 1;
    }));
    const topPerson = Object.entries(peopleCounts).sort((a, b) => b[1] - a[1])[0];
    const catCounts: Record<string, number> = {};
    incidents.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

    return { total: incidents.length, topPerson, topCat };
  }, [incidents]);

  // Format pattern labels per spec
  const formatPatternLabel = (inc: Incident): string | null => {
    const raw = occurrenceLabel?.(inc);
    if (!raw) return null;
    // "5th occurrence" → "Repeated 5 times"
    const occMatch = raw.match(/^(\d+)(?:st|nd|rd|th) occurrence$/);
    if (occMatch) return `Repeated ${occMatch[1]} times`;
    // "2 incidents involving X" → "X appears in 2 records"
    const invMatch = raw.match(/^(\d+) incidents involving (.+)$/);
    if (invMatch) return `${invMatch[2]} appears in ${invMatch[1]} records`;
    return raw;
  };

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">{summary.total} recorded incidents</span>
          {summary.topPerson && <> · {summary.topPerson[0]} appears in {summary.topPerson[1]} entries</>}
          {summary.topCat && <> · Most common: {summary.topCat[0]}</>}
        </p>
      </div>

      {/* Single-column timeline */}
      <div className="relative pl-5">
        {/* Spine */}
        <div className="absolute left-[7px] top-0 bottom-0 w-[1.5px] bg-border" />

        {grouped.map((group, gi) => (
          <div key={group.label} className="mb-6">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 -ml-5">
              {group.label}
            </h3>

            <div className="space-y-2.5">
              {group.items.map((inc, ii) => {
                const isVoided = !!inc.voided_at;
                const eCount = evidenceCounts[inc.id] || 0;
                const nCount = noteCounts[inc.id] || 0;
                const patternLabel = formatPatternLabel(inc);

                // Time gap label
                let gapLabel: string | null = null;
                const prevInc = ii > 0
                  ? group.items[ii - 1]
                  : gi > 0
                    ? grouped[gi - 1].items[grouped[gi - 1].items.length - 1]
                    : null;

                if (prevInc) {
                  const days = Math.abs(differenceInDays(
                    parseISO(inc.incident_date),
                    parseISO(prevInc.incident_date)
                  ));
                  if (days >= 3 && days <= 60) {
                    gapLabel = `No incidents recorded for ${days} days`;
                  }
                }

                return (
                  <div key={inc.id}>
                    {gapLabel && (
                      <p className="text-[10px] text-muted-foreground/40 italic mb-1.5 ml-2">{gapLabel}</p>
                    )}
                    <div className="relative">
                      {/* Node dot */}
                      <div
                        className="absolute -left-5 top-[14px] w-[7px] h-[7px] rounded-full bg-primary border-2 border-background z-10"
                        style={{ boxShadow: '0 0 0 1.5px hsl(var(--primary) / 0.2)' }}
                      />

                      <button
                        onClick={() => navigate(`/incident/${inc.id}`)}
                        className={`w-full text-left rounded-lg border border-border bg-card px-3.5 py-3 hover:shadow-[var(--shadow-card-hover)] transition-all duration-150 active:scale-[0.98] ${isVoided ? 'opacity-50' : ''}`}
                      >
                        {/* Date line + chevron */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                            <span>{format(parseISO(inc.incident_date), 'dd MMM yyyy')}</span>
                            {inc.incident_time && <><span>·</span><span>{inc.incident_time}</span></>}
                            {inc.location && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" /> {inc.location}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
                        </div>

                        {/* Title */}
                        <p className={`text-[13px] font-semibold leading-snug mb-1 ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {isVoided && <span className="text-[9px] font-medium text-muted-foreground/60 bg-muted rounded px-1 py-0.5 mr-1 no-underline inline-block">Voided</span>}
                          {inc.title || 'Untitled incident'}
                        </p>

                        {/* 1-2 line summary */}
                        {(inc.ai_summary || inc.raw_narrative) && (
                          <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2 mb-1.5">
                            {inc.ai_summary || inc.raw_narrative}
                          </p>
                        )}

                        {/* People */}
                        {inc.people_involved.length > 0 && (
                          <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mb-1.5">
                            <User className="h-2.5 w-2.5" /> {inc.people_involved.join(', ')}
                          </p>
                        )}

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-1">
                          {inc.category && <CategoryBadge category={inc.category} />}
                          {patternLabel && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-primary border border-primary/20 bg-primary/[0.06]">
                              {patternLabel}
                            </span>
                          )}
                          {eCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/50">
                              <Paperclip className="h-2.5 w-2.5" /> {eCount}
                            </span>
                          )}
                          {nCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/50">
                              <StickyNote className="h-2.5 w-2.5" /> {nCount}
                            </span>
                          )}
                          {inc.locked && <span className="text-primary text-[9px]">🔒</span>}
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChronologyTimeline;
