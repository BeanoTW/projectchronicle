import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { Incident } from '@/hooks/useIncidents';

import { CATEGORY_BORDER_COLORS, CATEGORY_LABELS } from '@/lib/categories';

const defaultBorder = 'border-l-muted-foreground/40';

interface DayGroup {
  dateISO: string;
  dateLabel: string;
  dayShort: string;
  dayNum: string;
  incidents: Incident[];
}

interface Props {
  incidents: Incident[];
}

const NarrativeDayView = ({ incidents }: Props) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 3 });

  /* ── Group incidents by date ── */
  const days: DayGroup[] = useMemo(() => {
    const sorted = [...incidents].sort(
      (a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime()
    );
    const map = new Map<string, Incident[]>();
    sorted.forEach(inc => {
      const key = inc.incident_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inc);
    });
    return Array.from(map.entries()).map(([dateISO, incs]) => {
      const d = parseISO(dateISO);
      return {
        dateISO,
        dateLabel: format(d, 'd MMM yyyy'),
        dayShort: format(d, 'EEE').toUpperCase(),
        dayNum: format(d, 'd MMM'),
        incidents: incs,
      };
    });
  }, [incidents]);

  /* ── Compute visible window on scroll ── */
  const COL_WIDTH = 164; // 150px col + 14px gap

  const updateVisibleRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el || days.length === 0) return;
    const startIdx = Math.max(0, Math.min(days.length - 1, Math.round(el.scrollLeft / COL_WIDTH)));
    const visibleCols = Math.max(1, Math.floor(el.clientWidth / COL_WIDTH));
    const endIdx = Math.min(startIdx + visibleCols - 1, days.length - 1);
    setVisibleRange(prev => {
      if (prev.start === startIdx && prev.end === endIdx) return prev;
      return { start: startIdx, end: endIdx };
    });
  }, [days.length]);

  useEffect(() => {
    updateVisibleRange();
  }, [days.length, updateVisibleRange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          updateVisibleRange();
          ticking = false;
        });
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [updateVisibleRange]);

  /* ── Derive summary from visible window ── */
  const { rangeLabel, summaryText, metaChips } = useMemo(() => {
    if (days.length === 0) {
      return {
        rangeLabel: '',
        summaryText: 'No incidents recorded.',
        metaChips: [],
      };
    }

    const slice = days.slice(visibleRange.start, visibleRange.end + 1);
    const allEvents = slice.flatMap(d => d.incidents);
    const first = slice[0];
    const last = slice[slice.length - 1];

    const rangeLabel = `${first.dateLabel} → ${last.dateLabel}`;

    // Category counts
    const catCounts: Record<string, number> = {};
    allEvents.forEach(e => {
      const cat = e.category || 'Other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const orderedCats = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => categoryLabel[cat] || cat.toLowerCase());

    const n = allEvents.length;
    const span = Math.abs(differenceInDays(parseISO(last.dateISO), parseISO(first.dateISO)));

    let summaryText: string;
    if (n === 0) {
      summaryText = 'No incidents recorded in this period.';
    } else if (n === 1) {
      summaryText = `1 incident recorded on ${first.dateLabel}.`;
    } else {
      summaryText = `${n} incidents recorded within ${span} days — ${first.dateLabel} to ${last.dateLabel}`;
      if (orderedCats.length > 0) {
        const top = orderedCats.slice(0, 2).join(' and ');
        summaryText += `, mainly relating to ${top}`;
      }
      summaryText += '.';

      const multiDays = slice.filter(d => d.incidents.length > 1).length;
      if (multiDays > 0) {
        summaryText += ` ${multiDays} day${multiDays === 1 ? '' : 's'} in this window contained more than one recorded event.`;
      }
    }

    const metaChips: string[] = [
      `${n} event${n === 1 ? '' : 's'} in view`,
      `${slice.length} day${slice.length === 1 ? '' : 's'} selected`,
    ];
    if (orderedCats[0]) metaChips.push(`Primary category: ${orderedCats[0]}`);

    return { rangeLabel, summaryText, metaChips };
  }, [days, visibleRange]);

  if (days.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-[13px] text-muted-foreground">No records to display.</p>
      </div>
    );
  }

  return (
    <div className="px-5">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-primary-dark text-primary-foreground px-4 py-3.5">
          <p className="text-[18px] font-extrabold leading-tight">Timeline</p>
          <p className="text-[14px] opacity-80 mt-0.5">Structured view</p>
        </div>

        {/* Range bar */}
        <div className="flex items-center justify-between px-4 py-2.5 text-[13px] text-muted-foreground border-b border-border">
          <span>{rangeLabel}</span>
        </div>

        {/* Day columns section */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-primary/80 uppercase mb-1">Structured</p>
          <p className="text-[13px] text-muted-foreground italic mb-3">"What happened in this selected period?"</p>

          {/* Scrollable day columns */}
          <div
            ref={scrollRef}
            className="overflow-x-auto pb-1.5 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-3.5" style={{ minWidth: 'max-content', paddingRight: 8 }}>
              {days.map((day, idx) => {
                const isActive = idx >= visibleRange.start && idx <= visibleRange.end;
                return (
                  <div
                    key={day.dateISO}
                    className={`w-[150px] min-h-[200px] border-r border-border last:border-r-0 pr-3 relative ${
                      isActive ? '' : ''
                    }`}
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    {/* Active highlight */}
                    {isActive && (
                      <div className="absolute -inset-1.5 bg-primary/[0.05] border border-primary/[0.15] rounded-2xl pointer-events-none" />
                    )}

                    {/* Day header */}
                    <p className="text-[12px] font-bold tracking-wider text-muted-foreground/60 uppercase relative z-10">
                      {day.dayShort}
                    </p>
                    <p className="text-[18px] font-extrabold text-foreground relative z-10">{day.dayNum}</p>

                    {/* Day accent line */}
                    <div className="h-[5px] bg-primary/60 rounded-full my-2 relative z-10" />

                    {/* Event cards */}
                    {day.incidents.map(inc => {
                      const borderClass = (inc.category && categoryBorderColor[inc.category]) || defaultBorder;
                      return (
                        <button
                          key={inc.id}
                          onClick={() => navigate(`/incident/${inc.id}`)}
                          className={`w-full text-left bg-muted/50 border border-border border-l-4 ${borderClass} rounded-xl px-2.5 py-2 mb-2.5 relative z-10 hover:shadow-sm active:scale-[0.98] transition-all duration-100`}
                        >
                          {inc.incident_time && (
                            <p className="text-[11px] text-muted-foreground/50 font-mono mb-0.5">
                              {inc.incident_time}
                            </p>
                          )}
                          <p className="text-[13px] font-bold leading-snug text-foreground">
                            {inc.title || 'Untitled incident'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scroll hint */}
          <p className="text-[12px] text-muted-foreground/40 text-center mt-1 mb-3">
            ← drag to inspect adjacent days →
          </p>

          {/* Summary block — flush beneath, no gap */}
          <div className="bg-accent/60 border border-primary/[0.12] rounded-2xl px-4 py-3.5 mb-3">
            <p className="text-[12px] font-extrabold tracking-wide text-primary/80 mb-2">
              Summary of selected period
            </p>
            <p className="text-[15px] leading-relaxed text-foreground/85">
              {summaryText}
            </p>
            {metaChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {metaChips.map((chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] text-primary/80 bg-background/60 border border-primary/[0.12]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 px-4 pb-4 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-warm-accent" /> Communication
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary" /> Action / Change
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-info" /> Record Issued
          </span>
        </div>
      </div>
    </div>
  );
};

export default NarrativeDayView;
