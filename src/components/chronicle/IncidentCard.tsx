import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';
import CategoryBadge from './CategoryBadge';
import RecordAgeChip from './RecordAgeChip';

interface IncidentCardProps {
  incident: Incident;
  showPatternLabel?: boolean;
  occurrenceLabel?: string | null;
  attachmentCount?: number;
  compact?: boolean;
  expandable?: boolean;
}

const categoryCardTints: Record<string, string> = {
  'Management Conduct': 'border-l-primary/40 bg-primary/[0.02]',
  'Verbal Comment': 'border-l-warm-accent/40 bg-warm-accent/[0.03]',
  'Safety Concern': 'border-l-severity-serious/40 bg-severity-serious/[0.02]',
  'Written Communication': 'border-l-info/30 bg-info/[0.02]',
  'Scheduling or Shift Change': 'border-l-muted-foreground/25 bg-muted/30',
  'Disciplinary Meeting': 'border-l-destructive/30 bg-destructive/[0.02]',
  'Pay or Payroll Issue': 'border-l-warm-accent/35 bg-warm-accent/[0.02]',
  'Policy Application': 'border-l-info/25 bg-info/[0.02]',
  'Workplace Meeting': 'border-l-primary/30 bg-primary/[0.02]',
};

// Format pattern labels per spec
function formatPatternLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const occMatch = raw.match(/^(\d+)(?:st|nd|rd|th) occurrence$/);
  if (occMatch) return `Repeated ${occMatch[1]} times`;
  const invMatch = raw.match(/^(\d+) incidents involving (.+)$/);
  if (invMatch) return `${invMatch[2]} appears in ${invMatch[1]} records`;
  return raw;
}

const IncidentCard = ({ incident, showPatternLabel, occurrenceLabel, attachmentCount, compact, expandable }: IncidentCardProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const tint = incident.category ? categoryCardTints[incident.category] || '' : '';

  const handleClick = () => {
    if (expandable) {
      setExpanded(prev => !prev);
    } else {
      navigate(`/incident/${incident.id}`);
    }
  };

  const patternText = formatPatternLabel(occurrenceLabel) || (showPatternLabel ? 'Repeated' : null);

  if (compact) {
    const previewText = incident.ai_summary || incident.raw_narrative;
    const isVoided = !!incident.voided_at;
    return (
      <div className={isVoided ? 'opacity-50' : ''}>
        <button
          onClick={handleClick}
          className={`w-full text-left rounded-xl border border-border border-l-4 px-3.5 py-3.5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px transition-all duration-200 active:scale-[0.98] ${tint}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className={`text-[14px] font-semibold line-clamp-1 flex-1 leading-snug ${isVoided ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {isVoided && <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5 mr-1.5 no-underline inline-block">Voided</span>}
              {incident.title || 'Untitled incident'}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">
                {format(parseISO(incident.incident_date), 'dd MMM')}
              </span>
              {expandable ? (
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
              )}
            </div>
          </div>
          {previewText && (
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed line-clamp-2 mt-1">
              {previewText}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            {incident.category && <CategoryBadge category={incident.category} />}
            {patternText && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-primary border border-primary/20 bg-primary/[0.06]">
                {patternText}
              </span>
            )}
            {(attachmentCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground/70">
                <Paperclip className="h-2.5 w-2.5" /> {attachmentCount}
              </span>
            )}
            {incident.locked && <span className="text-primary text-[11px]">🔒</span>}
          </div>
        </button>
        <AnimatePresence>
          {expandable && expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mx-1 mt-1 px-3.5 py-3 rounded-lg border border-border/60 bg-card/50 space-y-2">
                {(incident.ai_summary || incident.raw_narrative) && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {incident.ai_summary || incident.raw_narrative}
                  </p>
                )}
                {incident.location && (
                  <p className="text-[11px] text-muted-foreground/60">📍 {incident.location}</p>
                )}
                {incident.people_involved.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/60">People: {incident.people_involved.join(', ')}</p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/incident/${incident.id}`); }}
                  className="text-[12px] text-primary font-medium pt-1 transition-colors hover:text-primary/80"
                >
                  View full record →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const isVoidedFull = !!incident.voided_at;
  return (
    <button
      onClick={() => navigate(`/incident/${incident.id}`)}
      className={`w-full text-left rounded-xl border border-border border-l-4 p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px transition-all duration-200 active:scale-[0.98] ${tint} ${isVoidedFull ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className={`text-[15px] font-semibold line-clamp-1 flex-1 leading-snug ${isVoidedFull ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {isVoidedFull && <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5 mr-1.5 no-underline inline-block">Voided</span>}
          {incident.title || 'Untitled incident'}
        </h3>
        <div className="flex items-center gap-1.5">
          {incident.locked && <span className="text-primary text-[11px]">🔒</span>}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {incident.category && <CategoryBadge category={incident.category} />}
        <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
        {patternText && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-primary border border-primary/20 bg-primary/[0.06]">
            {patternText}
          </span>
        )}
      </div>

      <p className="text-[13px] text-muted-foreground/70 leading-relaxed line-clamp-2 mb-2.5">
        {incident.ai_summary || incident.raw_narrative}
      </p>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
        <span>{format(parseISO(incident.incident_date), 'dd MMM yyyy')}</span>
        {incident.location && (
          <>
            <span className="opacity-30">·</span>
            <span>{incident.location}</span>
          </>
        )}
      </div>
    </button>
  );
};

export default IncidentCard;
