import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Paperclip, FileText, Link2, X } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CategoryBadge, { CategoryLabel } from '@/components/chronicle/CategoryBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RecordTypeLabel from '@/components/chronicle/RecordTypeLabel';
import BoldedTitle from '@/components/chronicle/BoldedTitle';
import { useIncidents } from '@/hooks/useIncidents';
import { useEvidence } from '@/hooks/useEvidence';
import IncidentCard from '@/components/chronicle/IncidentCard';
import PageHeader from '@/components/chronicle/PageHeader';
import AttachmentsLibrary from '@/components/chronicle/AttachmentsLibrary';
import SummaryBuilderModal from '@/components/chronicle/SummaryBuilderModal';
import { PRIMARY_CATEGORIES, CATEGORY_BORDER_COLORS, CATEGORY_CARD_TINTS } from '@/lib/categories';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { displayTitle } from '@/lib/displayTitle';
import {
  loadSequenceConfig,
  saveSequenceConfig,
  createManualSequence,
  getSequenceMembership,
  type SequenceConfig,
} from '@/lib/sequenceEngine';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import type { Incident } from '@/hooks/useIncidents';

type DensityScale = 'detail' | 'compact' | 'overview';



const scaleLabels: { value: DensityScale; label: string }[] = [
  { value: 'detail', label: 'Detail' },
  { value: 'compact', label: 'Compact' },
  { value: 'overview', label: 'Overview' },
];

const exampleCards = [
  { title: 'Meeting with manager', date: '14 Jan 2025', category: 'Process / Procedure' },
  { title: 'Comment from colleague', date: '22 Jan 2025', category: 'Verbal Comment' },
  { title: 'Shift changed without notice', date: '3 Feb 2025', category: 'Work Allocation' },
];

const TIMELINE_HINT_KEY = 'chronicle-timeline-sequence-hint';

/* ── Overview marker component ── */
const OverviewMarker = ({
  incident,
  onClick,
}: {
  incident: Incident;
  onClick: () => void;
}) => {
  const borderClass = (incident.category && CATEGORY_BORDER_COLORS[incident.category]) || 'border-l-muted-foreground/40';
  const dotColour = borderClass.replace('border-l-', 'bg-');
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 py-0.5 w-full hover:bg-muted/20 rounded transition-colors active:scale-[0.98]"
    >
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColour}`} />
      <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">
        {format(parseISO(incident.incident_date), 'dd MMM')}
      </span>
    </button>
  );
};

const TimelineScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: allIncidents = [], isLoading } = useIncidents();
  const { data: allEvidence = [] } = useEvidence();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'incident' | 'daily_record'>('all');
  const [gapFilter, setGapFilter] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSummaryBuilder, setShowSummaryBuilder] = useState(false);
  const [scale, setScale] = useState<DensityScale>('compact');
  const { maskEntities } = usePrivacy();

  // Sequence selection state
  const [sequenceConfig, setSequenceConfig] = useState<SequenceConfig>(() => loadSequenceConfig());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Refs for scroll-to on overview tap
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const gap = searchParams.get('gap');
    if (gap) {
      setGapFilter(gap);
      setSearchParams({}, { replace: true });
    }
    // Focus date from Calendar
    const dateParam = searchParams.get('date');
    if (dateParam) {
      setSearchParams({}, { replace: true });
      // Scroll to date after render
      setTimeout(() => {
        const el = itemRefs.current[dateParam];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [searchParams, setSearchParams]);

  // First-visit hint
  useEffect(() => {
    if (allIncidents.length >= 2) {
      try {
        const seen = localStorage.getItem(TIMELINE_HINT_KEY);
        if (!seen) setShowHint(true);
      } catch { /* ignore */ }
    }
  }, [allIncidents.length]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem(TIMELINE_HINT_KEY, '1'); } catch { /* ignore */ }
  }, []);

  const sequenceMembership = useMemo(() => getSequenceMembership(sequenceConfig), [sequenceConfig]);

  const incidentsPreCategory = useMemo(() => {
    let filtered = [...allIncidents];
    if (recordTypeFilter !== 'all') {
      filtered = filtered.filter(i => (i.record_type || 'incident') === recordTypeFilter);
    }
    if (gapFilter === 'no-evidence') filtered = filtered.filter(i => !allEvidence.some(e => e.incident_id === i.id));
    if (gapFilter === 'no-witnesses') filtered = filtered.filter(i => i.witnesses.length === 0);
    if (gapFilter === 'no-exact-words') filtered = filtered.filter(i => !i.exact_words);
    if (gapFilter === 'no-impact') filtered = filtered.filter(i => !i.impact_note);
    return filtered;
  }, [allIncidents, recordTypeFilter, gapFilter, allEvidence]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    incidentsPreCategory.forEach(i => {
      const key = i.category || 'Not sure yet';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [incidentsPreCategory]);

  const incidents = useMemo(() => {
    let filtered = incidentsPreCategory;
    if (filterCategory !== 'all') {
      if (filterCategory === 'Not sure yet') {
        filtered = filtered.filter(i => !i.category || i.category === 'Not sure yet');
      } else {
        filtered = filtered.filter(i => i.category === filterCategory);
      }
    }
    return [...filtered].sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime());
  }, [incidentsPreCategory, filterCategory]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof incidents> = {};
    incidents.forEach(inc => {
      const key = format(parseISO(inc.incident_date), 'MMMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(inc);
    });
    return groups;
  }, [incidents]);

  const handleOverviewTap = useCallback((incidentId: string) => {
    setScale('compact');
    setTimeout(() => {
      const el = itemRefs.current[incidentId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, []);

  const beginLongPress = useCallback((id: string) => {
    if (selectMode) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setSelectMode(true);
      setSelectedIds(new Set([id]));
    }, 500);
  }, [selectMode]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleCreateSequence = useCallback(() => {
    if (selectedIds.size < 2) return;
    const updated = createManualSequence(sequenceConfig, [...selectedIds], allIncidents);
    setSequenceConfig(updated);
    saveSequenceConfig(updated);
    toast({
      title: 'Sequence created',
      description: `${selectedIds.size} records linked. Records remain in chronological order.`,
    });
    exitSelectMode();
  }, [selectedIds, sequenceConfig, allIncidents, toast, exitSelectMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 flex items-center justify-center">
        <p className="text-muted-foreground text-[14px]">Loading...</p>
      </div>
    );
  }

  if (allIncidents.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Timeline" subtitle="Your record over time" />
        <div className="px-5 mt-2">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-3">
            Your first entries might look like this
          </p>
          <div className="space-y-2.5 opacity-50 pointer-events-none select-none" aria-hidden="true">
            {exampleCards.map((card, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-[11px] text-muted-foreground/60 mb-0.5">{card.date}</p>
                <p className="text-[13px] font-medium text-foreground/70">{card.title}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                  {card.category}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={() => navigate('/record')}
              className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]"
            >
              Create your first record
            </button>
            <p className="text-[11px] text-muted-foreground/60 text-center max-w-xs">
              You can record events as they happen, or add them later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Timeline" subtitle="Your record over time">
        <button
          onClick={() => setShowLibrary(true)}
          className="p-2 rounded-lg hover:bg-muted/40 text-warm-accent/70 hover:text-warm-accent transition-colors relative"
          aria-label="Attachments"
        >
          <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.5} />
          {allEvidence.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
              {allEvidence.length}
            </span>
          )}
        </button>
      </PageHeader>

      {/* First-visit sequence hint */}
      {showHint && !selectMode && (
        <div className="mx-5 mb-3 px-3.5 py-2.5 rounded-lg bg-primary/[0.06] border border-primary/15 flex items-start gap-2.5">
          <Link2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] text-foreground leading-relaxed">
              You can link related records across time by selecting them and creating a sequence.
            </p>
          </div>
          <button
            onClick={dismissHint}
            aria-label="Dismiss"
            className="p-0.5 -mr-1 -mt-0.5 text-muted-foreground/60 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Record-type filter (All / Incidents / Daily records) */}
      <div className="px-5 mb-2 flex gap-1.5">
        {([
          { v: 'all', label: 'All' },
          { v: 'incident', label: 'Incidents' },
          { v: 'daily_record', label: 'Daily records' },
        ] as const).map(opt => (
          <button
            key={opt.v}
            onClick={() => setRecordTypeFilter(opt.v)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
              recordTypeFilter === opt.v
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Scale selector */}
      <div className="px-5 mb-3 flex gap-1.5">
        {scaleLabels.map(s => (
          <button
            key={s.value}
            onClick={() => setScale(s.value)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
              scale === s.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Category filters — hidden in Overview */}
      {scale !== 'overview' && (
        <>
          {gapFilter && (
            <div className="mx-5 mb-3 px-3.5 py-2.5 rounded-lg bg-warm-accent-light text-warm-accent-foreground text-[13px] font-medium flex items-center justify-between border border-warm-accent/15">
              <span>Filtered: {gapFilter.replace('no-', 'missing ').replace('-', ' ')}</span>
              <button onClick={() => setGapFilter(null)} className="text-[13px] underline">Clear</button>
            </div>
          )}
          <div className="px-5 pb-4">
            <Select
              value={filterCategory}
              onValueChange={(v) => { setFilterCategory(v); setGapFilter(null); }}
            >
              <SelectTrigger
                className="h-9 w-full bg-muted/40 border-0 text-[12px] font-medium text-foreground rounded-lg px-3 hover:bg-muted/60 transition-colors focus:ring-1 focus:ring-ring focus:ring-offset-0"
                aria-label="Filter by category"
              >
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                <SelectItem value="all" className="text-[13px]">
                  All categories{incidentsPreCategory.length > 0 ? ` (${incidentsPreCategory.length})` : ''}
                </SelectItem>
                {PRIMARY_CATEGORIES.filter(c => c !== 'Other').map(c => (
                  <SelectItem key={c} value={c} className="text-[13px]">
                    {c}{categoryCounts[c] ? ` (${categoryCounts[c]})` : ''}
                  </SelectItem>
                ))}
                <SelectItem value="Not sure yet" className="text-[13px]">
                  Not sure yet{categoryCounts['Not sure yet'] ? ` (${categoryCounts['Not sure yet']})` : ''}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {incidents.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-[13px] text-muted-foreground">No records match this filter.</p>
        </div>
      ) : (
        <div className="px-5" ref={scrollContainerRef}>
          {/* ─── OVERVIEW ─── */}
          {scale === 'overview' && (
            <div className="space-y-4">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    {month}
                  </h2>
                  <div className="space-y-0.5">
                    {items.map(inc => (
                      <div key={inc.id} ref={el => { itemRefs.current[inc.id] = el; }}>
                        <OverviewMarker
                          incident={inc}
                          onClick={() => handleOverviewTap(inc.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── COMPACT ─── */}
          {scale === 'compact' && (
            <div className="space-y-5">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {month}
                  </h2>
                  <div className="space-y-1.5">
                    {items.map(inc => {
                      const isVoided = !!inc.voided_at;
                      const isDaily = inc.record_type === 'daily_record';
                      // Per-category tint (border + subtle bg). Increased border thickness
                      // (border-l-[5px]) for stronger visual hierarchy.
                      const tintCombo = isDaily
                        ? 'border-l-muted-foreground/30 bg-card'
                        : (inc.category && CATEGORY_CARD_TINTS[inc.category as keyof typeof CATEGORY_CARD_TINTS])
                          || 'border-l-muted-foreground/40 bg-card';
                      const categoryDisplay = inc.category || 'Not sure yet';
                      const inSequence = !!sequenceMembership[inc.id];
                      const isSelected = selectedIds.has(inc.id);
                      const titleText = maskEntities(displayTitle(inc), inc);

                      return (
                        <div
                          key={inc.id}
                          ref={el => { itemRefs.current[inc.id] = el; itemRefs.current[inc.incident_date.slice(0, 10)] = el; }}
                          className="flex items-stretch gap-2 min-w-0 w-full"
                        >
                          {selectMode && (
                            <div className="flex items-center pl-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(inc.id)}
                                aria-label="Select for sequence"
                              />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              if (selectMode) toggleSelect(inc.id);
                              else navigate(`/incident/${inc.id}`);
                            }}
                            onPointerDown={() => beginLongPress(inc.id)}
                            onPointerUp={cancelLongPress}
                            onPointerLeave={cancelLongPress}
                            onPointerCancel={cancelLongPress}
                            className={`flex-1 min-w-0 text-left rounded-lg border border-border border-l-[5px] ${tintCombo} px-3 py-2.5 hover:bg-muted/20 transition-all duration-150 active:scale-[0.98] ${isVoided ? 'opacity-50' : ''} ${isDaily ? 'opacity-85' : ''} ${isSelected ? 'ring-2 ring-primary/40' : ''}`}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <RecordTypeLabel recordType={inc.record_type} />
                              {!isDaily && (
                                <CategoryLabel category={categoryDisplay} subtype={inc.subtype ?? undefined} />
                              )}
                              {inSequence && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] text-primary/70"
                                  title="Part of a sequence"
                                  aria-label="Part of a sequence"
                                >
                                  <Link2 className="h-3 w-3" strokeWidth={2} />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1 leading-relaxed min-w-0">
                              <span className={`text-[13px] truncate flex-1 min-w-0 ${isVoided ? 'text-muted-foreground line-through' : isDaily ? 'text-foreground/80' : 'text-foreground'}`}>
                                {isVoided && <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted rounded px-1 py-0.5 mr-1 no-underline inline-block">Voided</span>}
                                <BoldedTitle text={titleText} leadingWords={4} />
                              </span>
                              <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap flex-shrink-0">
                                {format(parseISO(inc.incident_date), 'dd MMM')}
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── DETAIL ─── */}
          {scale === 'detail' && (
            <div className="pl-6 timeline-spine space-y-6">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 -ml-6">
                    {month}
                  </h2>
                  <div className="space-y-3">
                    {items.map(inc => {
                      const attachmentCount = allEvidence.filter(e => e.incident_id === inc.id).length;
                      return (
                        <div
                          key={inc.id}
                          className="timeline-node"
                          ref={el => { itemRefs.current[inc.id] = el; }}
                        >
                          <IncidentCard
                            incident={inc}
                            attachmentCount={attachmentCount}
                            compact
                            expandable
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sequence selection footer */}
      {selectMode && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4 pb-3">
          <div className="mx-auto max-w-md bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-[12px] text-foreground flex-1">
              {selectedIds.size} selected
              {selectedIds.size < 2 && <span className="text-muted-foreground"> · pick at least 2</span>}
            </p>
            <button
              onClick={exitSelectMode}
              className="px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSequence}
              disabled={selectedIds.size < 2}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-md bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create sequence
            </button>
          </div>
        </div>
      )}

      <AttachmentsLibrary open={showLibrary} onClose={() => setShowLibrary(false)} />
      <SummaryBuilderModal open={showSummaryBuilder} onClose={() => setShowSummaryBuilder(false)} incidents={allIncidents} />
    </div>
  );
};

export default TimelineScreen;
