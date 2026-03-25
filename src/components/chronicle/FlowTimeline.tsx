import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';

const categoryColors: Record<string, string> = {
  'Management Conduct': 'hsl(var(--primary))',
  'Verbal Comment': 'hsl(var(--warm-accent))',
  'Safety Concern': 'hsl(var(--severity-serious))',
  'Written Communication': 'hsl(var(--info))',
  'Scheduling or Shift Change': 'hsl(var(--muted-foreground))',
  'Disciplinary Meeting': 'hsl(var(--destructive))',
  'Pay or Payroll Issue': 'hsl(var(--warm-accent))',
  'Policy Application': 'hsl(var(--info))',
  'Workplace Meeting': 'hsl(var(--primary))',
  'Other': 'hsl(var(--muted-foreground))',
};

const severitySizes: Record<string, number> = {
  Critical: 20,
  Serious: 16,
  Moderate: 12,
  Low: 10,
};

interface Props {
  incidents: Incident[];
  repeatedPeople: Set<string>;
  totalIncidents: number;
  mostFrequentPerson: string | null;
}

const FlowTimeline = ({ incidents, repeatedPeople, totalIncidents, mostFrequentPerson }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sort oldest-first for spatial left→right progression
  const sorted = useMemo(() =>
    [...incidents].sort((a, b) => new Date(a.incident_date).getTime() - new Date(b.incident_date).getTime()),
    [incidents]
  );

  // Group by month
  const months = useMemo(() => {
    const groups: { label: string; incidents: typeof sorted }[] = [];
    let currentMonth = '';
    sorted.forEach(inc => {
      const month = format(parseISO(inc.incident_date), 'MMM yyyy');
      if (month !== currentMonth) {
        groups.push({ label: month, incidents: [] });
        currentMonth = month;
      }
      groups[groups.length - 1].incidents.push(inc);
    });
    return groups;
  }, [sorted]);

  // Frequency trend
  const frequencyTrend = useMemo(() => {
    if (sorted.length < 4) return null;
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);
    const firstSpan = differenceInDays(
      parseISO(firstHalf[firstHalf.length - 1].incident_date),
      parseISO(firstHalf[0].incident_date)
    ) || 1;
    const secondSpan = differenceInDays(
      parseISO(secondHalf[secondHalf.length - 1].incident_date),
      parseISO(secondHalf[0].incident_date)
    ) || 1;
    const firstRate = firstHalf.length / firstSpan;
    const secondRate = secondHalf.length / secondSpan;
    if (secondRate > firstRate * 1.3) return 'Increasing frequency';
    if (secondRate < firstRate * 0.7) return 'Decreasing frequency';
    return null;
  }, [sorted]);

  const hasRepeatedPerson = (inc: Incident) =>
    inc.people_involved.some(p => repeatedPeople.has(p));

  const getDotSize = (inc: Incident) =>
    severitySizes[inc.severity || ''] || 10;

  const getDotColor = (inc: Incident) =>
    categoryColors[inc.category || ''] || 'hsl(var(--muted-foreground))';

  const selectedIncident = sorted.find(i => i.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center gap-4 px-1 text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{totalIncidents} recorded</span>
        {mostFrequentPerson && (
          <>
            <span className="opacity-30">·</span>
            <span>{mostFrequentPerson} appears most</span>
          </>
        )}
        {frequencyTrend && (
          <>
            <span className="opacity-30">·</span>
            <span className="text-primary font-medium">{frequencyTrend}</span>
          </>
        )}
      </div>

      {/* Horizontal scrollable flow */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide -mx-5 px-5"
      >
        <div className="flex items-end gap-0 min-w-max pb-2 pt-8 relative">
          {/* Baseline */}
          <div className="absolute bottom-[22px] left-0 right-0 h-[1.5px] bg-border" />

          {months.map((month, mi) => (
            <div key={month.label} className="flex flex-col items-start">
              {/* Month label */}
              <div className="flex items-end gap-1 relative">
                {month.incidents.map((inc, ii) => {
                  const size = getDotSize(inc);
                  const color = getDotColor(inc);
                  const hasRing = hasRepeatedPerson(inc);
                  const isSelected = selectedId === inc.id;

                  // Calculate gap from previous incident
                  const prevInc = ii > 0
                    ? month.incidents[ii - 1]
                    : mi > 0
                      ? months[mi - 1].incidents[months[mi - 1].incidents.length - 1]
                      : null;

                  const gap = prevInc
                    ? differenceInDays(parseISO(inc.incident_date), parseISO(prevInc.incident_date))
                    : 0;

                  // Spacing: tight clustering with minimum gap
                  const marginLeft = ii === 0 && mi === 0
                    ? 0
                    : Math.max(4, Math.min(gap * 2, 24));

                  return (
                    <button
                      key={inc.id}
                      onClick={() => setSelectedId(isSelected ? null : inc.id)}
                      className="relative flex flex-col items-center group"
                      style={{ marginLeft }}
                    >
                      <div
                        className="rounded-full transition-all duration-200 relative z-10"
                        style={{
                          width: size,
                          height: size,
                          backgroundColor: color,
                          boxShadow: isSelected
                            ? `0 0 0 3px hsl(var(--background)), 0 0 0 5px ${color}`
                            : hasRing
                              ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${color}`
                              : 'none',
                          transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                          marginBottom: `${22 - size / 2}px`,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-[9px] text-muted-foreground/50 mt-1.5 pl-1 whitespace-nowrap">
                {month.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} /> Management
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--warm-accent))' }} /> Verbal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--severity-serious))' }} /> Safety
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--info))' }} /> Written
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-current" style={{ boxShadow: '0 0 0 1.5px currentColor' }} /> Repeated person
        </span>
      </div>

      {/* Selected incident detail */}
      <AnimatePresence>
        {selectedIncident && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]"
          >
            <span className="text-[10px] text-muted-foreground/60 block mb-1">
              {format(parseISO(selectedIncident.incident_date), 'dd MMM yyyy')}
              {selectedIncident.incident_time && ` · ${selectedIncident.incident_time}`}
            </span>
            <p className="text-[14px] font-semibold text-foreground leading-snug mb-1">
              {selectedIncident.title || 'Untitled incident'}
            </p>
            {(selectedIncident.ai_summary || selectedIncident.raw_narrative) && (
              <p className="text-[12px] text-muted-foreground/60 leading-relaxed line-clamp-2 mb-2">
                {selectedIncident.ai_summary || selectedIncident.raw_narrative}
              </p>
            )}
            {selectedIncident.people_involved.length > 0 && (
              <p className="text-[11px] text-muted-foreground/50 mb-2">
                {selectedIncident.people_involved.join(', ')}
              </p>
            )}
            <button
              onClick={() => navigate(`/incident/${selectedIncident.id}`)}
              className="text-[12px] text-primary font-medium transition-colors hover:text-primary/80"
            >
              View full record →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlowTimeline;
