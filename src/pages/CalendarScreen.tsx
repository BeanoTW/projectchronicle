import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { CalendarDays, ChevronRight, X } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import PageHeader from '@/components/chronicle/PageHeader';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CATEGORY_BORDER_COLORS, resolveCategory } from '@/lib/categories';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { displayTitle } from '@/lib/displayTitle';
import type { Incident } from '@/hooks/useIncidents';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* Dot colour from category for incidents; neutral for daily records */
const dotClassFor = (inc: Incident): string => {
  if (inc.record_type === 'daily_record') return 'bg-muted-foreground/50';
  const resolved = resolveCategory(inc.category);
  const borderClass = CATEGORY_BORDER_COLORS[resolved] || 'border-l-muted-foreground/40';
  return borderClass.replace('border-l-', 'bg-');
};

/* Build the list of months to render (vertical scroll).
   Range: from the earliest record month to the current month + 1, inclusive.
   Falls back to 6 months around today if there are no records yet. */
const buildMonthList = (incidents: Incident[]): Date[] => {
  const today = new Date();
  let start = startOfMonth(today);
  let end = startOfMonth(addMonths(today, 1));
  if (incidents.length > 0) {
    const dates = incidents
      .filter(i => !i.voided_at)
      .map(i => parseISO(i.incident_date.slice(0, 10)));
    if (dates.length > 0) {
      const min = dates.reduce((a, b) => (a < b ? a : b));
      start = startOfMonth(min);
    }
  }
  const months: Date[] = [];
  let cur = start;
  while (cur <= end) {
    months.push(cur);
    cur = addMonths(cur, 1);
  }
  return months;
};

interface MonthBlockProps {
  month: Date;
  incidentsByDate: Map<string, Incident[]>;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  registerCurrentMonthRef: (el: HTMLDivElement | null) => void;
  isCurrentMonth: boolean;
}

const MonthBlock = ({
  month,
  incidentsByDate,
  selectedDate,
  onSelectDate,
  registerCurrentMonthRef,
  isCurrentMonth,
}: MonthBlockProps) => {
  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [month]);

  return (
    <div ref={isCurrentMonth ? registerCurrentMonthRef : undefined} className="mb-6">
      <h2 className="text-[14px] font-semibold text-foreground px-5 mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
        {format(month, 'MMMM yyyy')}
      </h2>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-5 mb-1">
        {WEEKDAYS.map(d => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-5 gap-px">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayIncidents = incidentsByDate.get(key) || [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const hasRecords = dayIncidents.length > 0;

          return (
            <button
              key={idx}
              onClick={() => hasRecords && onSelectDate(day)}
              disabled={!inMonth || !hasRecords}
              className={`relative flex flex-col items-center py-2 min-h-[48px] rounded-lg transition-all duration-100 ${
                !inMonth ? 'opacity-20 pointer-events-none' : ''
              } ${selected ? 'bg-primary/10 ring-1 ring-primary/30' : ''} ${
                today && !selected ? 'ring-1 ring-muted-foreground/20' : ''
              } ${hasRecords && !selected ? 'hover:bg-muted/40' : ''}`}
            >
              <span
                className={`text-[13px] ${
                  selected
                    ? 'text-primary font-semibold'
                    : today
                    ? 'text-foreground font-semibold'
                    : hasRecords
                    ? 'text-foreground font-medium'
                    : 'text-foreground/60'
                }`}
              >
                {format(day, 'd')}
              </span>
              {hasRecords && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {dayIncidents.slice(0, 3).map((inc, ci) => (
                    <span key={ci} className={`w-1.5 h-1.5 rounded-full ${dotClassFor(inc)}`} />
                  ))}
                  {dayIncidents.length > 3 && (
                    <span className="text-[8px] font-bold text-primary ml-0.5">
                      +{dayIncidents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CalendarScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const currentMonthRef = useRef<HTMLDivElement | null>(null);
  const { maskEntities } = usePrivacy();

  /* Index incidents by date string (using incident_date, not created_at) */
  const incidentsByDate = useMemo(() => {
    const map = new Map<string, Incident[]>();
    incidents
      .filter(i => !i.voided_at)
      .forEach(i => {
        const key = i.incident_date.slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(i);
      });
    return map;
  }, [incidents]);

  const months = useMemo(() => buildMonthList(incidents), [incidents]);
  const todayMonthKey = format(startOfMonth(new Date()), 'yyyy-MM');

  /* Scroll current month into view on first paint */
  useEffect(() => {
    if (currentMonthRef.current) {
      currentMonthRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [months.length]);

  /* Selected day incidents (chronological order by incident_time) */
  const selectedIncidents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return (incidentsByDate.get(key) || []).sort(
      (a, b) => (a.incident_time || '').localeCompare(b.incident_time || '')
    );
  }, [selectedDate, incidentsByDate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <p className="text-muted-foreground text-[14px]">Loading...</p>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Calendar" />
        <div className="px-5 pt-8 text-center">
          <CalendarDays className="h-9 w-9 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-foreground mb-1">No records yet</h3>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Your calendar will show when events were recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Calendar" subtitle="Date-based navigation" />

      {/* Vertically scrollable month list */}
      <div className="pt-2">
        {months.map(m => (
          <MonthBlock
            key={format(m, 'yyyy-MM')}
            month={m}
            incidentsByDate={incidentsByDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            registerCurrentMonthRef={el => { currentMonthRef.current = el; }}
            isCurrentMonth={format(m, 'yyyy-MM') === todayMonthKey}
          />
        ))}
      </div>

      {/* Bottom-sheet day card */}
      <Sheet open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t border-border max-h-[80vh] overflow-y-auto">
          {selectedDate && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-[15px] font-semibold text-foreground">
                  {format(selectedDate, 'EEEE, d MMMM yyyy')}
                </SheetTitle>
                <p className="text-[12px] text-muted-foreground">
                  {selectedIncidents.length} record{selectedIncidents.length !== 1 ? 's' : ''} on this date
                </p>
              </SheetHeader>

              <div className="mt-4 divide-y divide-border">
                {selectedIncidents.map(inc => {
                  const isDaily = inc.record_type === 'daily_record';
                  const borderClass = isDaily
                    ? 'border-l-muted-foreground/40'
                    : (inc.category && CATEGORY_BORDER_COLORS[inc.category]) || 'border-l-muted-foreground/40';
                  return (
                    <button
                      key={inc.id}
                      onClick={() => {
                        setSelectedDate(null);
                        navigate(`/incident/${inc.id}`);
                      }}
                      className={`flex items-center gap-3 px-3 py-3 w-full text-left hover:bg-muted/30 transition-colors border-l-4 ${borderClass} ${isDaily ? 'opacity-90' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            isDaily ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                          }`}>
                            {isDaily ? 'Daily record' : 'Incident'}
                          </span>
                          {inc.incident_time && (
                            <span className="text-[11px] text-muted-foreground/60 font-mono">{inc.incident_time}</span>
                          )}
                        </div>
                        <p className={`text-[13px] font-medium truncate ${isDaily ? 'text-foreground/85' : 'text-foreground'}`}>
                          {maskEntities(displayTitle(inc), inc)}
                        </p>
                        {!isDaily && inc.category && (
                          <span className="text-[11px] text-muted-foreground">{inc.category}</span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-border">
                <button
                  onClick={() => {
                    const d = format(selectedDate, 'yyyy-MM-dd');
                    setSelectedDate(null);
                    navigate(`/timeline?date=${d}`);
                  }}
                  className="text-[12px] text-primary font-medium hover:text-primary/80 transition-colors"
                >
                  View in Timeline →
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CalendarScreen;
