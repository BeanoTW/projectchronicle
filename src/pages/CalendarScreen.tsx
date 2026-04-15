import { useState, useMemo } from 'react';
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
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import PageHeader from '@/components/chronicle/PageHeader';
import { CATEGORY_BORDER_COLORS, resolveCategory } from '@/lib/categories';
import type { Incident } from '@/hooks/useIncidents';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* Dot colour from category — uses resolved category + existing border tokens */
const categoryDotColour = (category: string | null): string => {
  const resolved = resolveCategory(category);
  const borderClass = CATEGORY_BORDER_COLORS[resolved] || 'border-l-muted-foreground/40';
  // Convert border-l-X to bg-X for dots
  return borderClass.replace('border-l-', 'bg-');
};

const CalendarScreen = () => {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useIncidents();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  /* Index incidents by date string */
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

  /* Calendar grid */
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [currentMonth]);

  /* Selected day incidents */
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

      {/* Month header */}
      <div className="flex items-center justify-between px-5 mb-4">
        <button
          onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-[16px] font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-5 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-5 gap-px">
        {calendarDays.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayIncidents = incidentsByDate.get(key) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const hasRecords = dayIncidents.length > 0;

          return (
            <button
              key={idx}
              onClick={() => hasRecords ? setSelectedDate(day) : setSelectedDate(null)}
              className={`relative flex flex-col items-center py-2 min-h-[52px] rounded-lg transition-all duration-100 ${
                !inMonth ? 'opacity-20 pointer-events-none' : ''
              } ${selected ? 'bg-primary/10 ring-1 ring-primary/30' : ''} ${
                today && !selected ? 'ring-1 ring-muted-foreground/20' : ''
              } ${hasRecords && !selected ? 'hover:bg-muted/40' : ''}`}
            >
              <span className={`text-[13px] font-medium ${
                selected ? 'text-primary font-semibold' : today ? 'text-foreground font-semibold' : 'text-foreground'
              }`}>
                {format(day, 'd')}
              </span>
              {/* Dots (max 3) + count badge */}
              {hasRecords && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {dayIncidents.slice(0, 3).map((inc, ci) => (
                    <span key={ci} className={`w-1.5 h-1.5 rounded-full ${categoryDotColour(inc.category)}`} />
                  ))}
                  {dayIncidents.length > 3 && (
                    <span className="text-[8px] font-bold text-primary ml-0.5">+{dayIncidents.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail panel (Mode B) */}
      {selectedDate && (
        <div className="mx-5 mt-4 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-[14px] font-semibold text-foreground">
                {format(selectedDate, 'd MMMM yyyy')}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {selectedIncidents.length} incident{selectedIncidents.length !== 1 ? 's' : ''} recorded on this date
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Time span */}
          {selectedIncidents.length >= 2 && selectedIncidents[0].incident_time && selectedIncidents[selectedIncidents.length - 1].incident_time && (
            <p className="px-4 py-2 text-[12px] text-muted-foreground border-b border-border">
              Records span {selectedIncidents[0].incident_time}–{selectedIncidents[selectedIncidents.length - 1].incident_time}
            </p>
          )}

          {/* Incident list */}
          <div className="divide-y divide-border">
            {selectedIncidents.map(inc => {
              const borderClass = (inc.category && CATEGORY_BORDER_COLORS[inc.category]) || 'border-l-muted-foreground/40';
              return (
                <button
                  key={inc.id}
                  onClick={() => navigate(`/incident/${inc.id}`)}
                  className={`flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-muted/30 transition-colors border-l-4 ${borderClass}`}
                >
                  <div className="flex-1 min-w-0">
                    {inc.incident_time && (
                      <span className="text-[11px] text-muted-foreground/50 font-mono">{inc.incident_time}</span>
                    )}
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {inc.title || 'Untitled incident'}
                    </p>
                    {inc.category && (
                      <span className="text-[11px] text-muted-foreground">{inc.category}</span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Jump to timeline */}
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={() => navigate(`/timeline?date=${format(selectedDate, 'yyyy-MM-dd')}`)}
              className="text-[12px] text-primary font-medium hover:text-primary/80 transition-colors"
            >
              View in Timeline →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarScreen;
