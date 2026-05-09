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
import { useTrackScreenView } from '@/lib/analytics/useTrackScreenView';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* Dot colour from category for incidents; neutral for daily records */
const dotClassFor = (inc: Incident): string => {
  if (inc.record_type === 'daily_record') return 'bg-muted-foreground/50';
  const resolved = resolveCategory(inc.category);
  const borderClass = CATEGORY_BORDER_COLORS[resolved] || 'border-l-muted-foreground/40';
  return borderClass.replace('border-l-', 'bg-');
};

/* Resolve the effective date for a record:
   - incident → incident_date
   - daily_record → record_date (fallback to incident_date if null) */
const effectiveDateStr = (inc: Incident): string => {
  const isDaily = inc.record_type === 'daily_record';
  const raw = isDaily ? ((inc as any).record_date || inc.incident_date) : inc.incident_date;
  return raw.slice(0, 10);
};

/* Build the list of months to render (vertical scroll).
   Data-driven range: earliest record month → latest record month, inclusive.
   All months in between are rendered (even if empty).
   Falls back to current month if there are no records yet. */
const buildMonthList = (incidents: Incident[]): Date[] => {
  const today = new Date();
  let start = startOfMonth(today);
  let end = startOfMonth(today);
  const active = incidents.filter(i => !i.voided_at);
  if (active.length > 0) {
    const dates = active.map(i => parseISO(effectiveDateStr(i)));
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    start = startOfMonth(min);
    end = startOfMonth(max);
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
  useTrackScreenView('calendar_viewed');
  const { data: incidents = [], isLoading } = useIncidents();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const currentMonthRef = useRef<HTMLDivElement | null>(null);
  const { maskEntities } = usePrivacy();

  /* Index incidents by effective date string (incident_date for incidents, record_date for daily records) */
  const incidentsByDate = useMemo(() => {
    const map = new Map<string, Incident[]>();
    incidents
      .filter(i => !i.voided_at)
      .forEach(i => {
        const key = effectiveDateStr(i);
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
    // Ghost month grid: current month, Mon-start, with a natural distribution of markers.
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const ghostDays: Date[] = [];
    let cur = gridStart;
    while (cur <= gridEnd) {
      ghostDays.push(cur);
      cur = addDays(cur, 1);
    }
    // Day-of-month markers: shapes only, identical neutral colour.
    // 'i' = incident (solid circle), 'd' = daily record (ring).
    // Distribution: 8 marked days, isolated + one slightly denser cluster, exactly one day with 2 markers.
    const ghostMarks: Record<number, ('i' | 'd')[]> = {
      3: ['i'],
      7: ['d'],
      11: ['i'],
      12: ['i', 'd'],   // the one day with 2 records (mixed)
      13: ['i'],        // cluster continues
      18: ['d'],
      24: ['i'],
      27: ['i'],
    };

    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Calendar" />
        <div className="px-5 pt-4">
          <div aria-hidden="true" className="opacity-50 pointer-events-none select-none">
            <h2 className="text-[14px] font-semibold text-foreground mb-2">
              {format(monthStart, 'MMMM yyyy')}
            </h2>
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider py-1"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {ghostDays.map((day, idx) => {
                const inMonth = isSameMonth(day, monthStart);
                const dom = day.getDate();
                const marks = inMonth ? ghostMarks[dom] || [] : [];
                return (
                  <div
                    key={idx}
                    className={`relative flex flex-col items-center py-2 min-h-[48px] rounded-lg ${
                      !inMonth ? 'opacity-30' : ''
                    }`}
                  >
                    <span
                      className={`text-[13px] ${
                        marks.length > 0 ? 'text-foreground font-medium' : 'text-foreground/60'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {marks.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {marks.map((m, ci) =>
                          m === 'i' ? (
                            <span
                              key={ci}
                              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70"
                            />
                          ) : (
                            <span
                              key={ci}
                              className="w-1.5 h-1.5 rounded-full border-[1.5px] border-muted-foreground/70"
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="text-[15px] font-semibold text-foreground mb-1">Nothing here yet</h3>
            <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed mb-5">
              Your calendar fills as you record events.
            </p>
            <button
              onClick={() => navigate('/record')}
              className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]"
            >
              Create your first record
            </button>
            <p className="text-[11px] text-muted-foreground/60 mt-2">
              You can record events as they happen, or add them later.
            </p>
          </div>
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
