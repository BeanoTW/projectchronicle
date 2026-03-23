import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/hooks/useIncidents';
import CategoryBadge from './CategoryBadge';
import RecordAgeChip from './RecordAgeChip';

interface IncidentCardProps {
  incident: Incident;
  showPatternLabel?: boolean;
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

const IncidentCard = ({ incident, showPatternLabel, compact, expandable }: IncidentCardProps) => {
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

  if (compact) {
    const previewText = incident.ai_summary || incident.raw_narrative;
    return (
      <div>
        <button
          onClick={handleClick}
          className={`w-full text-left rounded-xl border border-border border-l-4 px-3.5 py-3.5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px transition-all duration-200 active:scale-[0.98] ${tint}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-foreground line-clamp-1 flex-1 leading-snug">
              {incident.title || 'Untitled incident'}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">
                {format(parseISO(incident.incident_date), 'dd MMM')}
              </span>
              {expandable && (
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
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
            {showPatternLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-primary/70 border border-primary/15 bg-primary/[0.04]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 8a6 6 0 0 1 6-6v0a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6v0" strokeLinecap="round"/><path d="M8 14a6 6 0 0 1-6-6" strokeLinecap="round" strokeDasharray="2 3"/></svg>
                Repeated
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
              <div className={`mx-1 mt-1 px-3.5 py-3 rounded-lg border border-border/60 bg-card/50 space-y-2`}>
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

  return (
    <button
      onClick={() => navigate(`/incident/${incident.id}`)}
      className={`w-full text-left rounded-xl border border-border border-l-4 p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px transition-all duration-200 active:scale-[0.98] ${tint}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[15px] font-semibold text-foreground line-clamp-1 flex-1 leading-snug">
          {incident.title || 'Untitled incident'}
        </h3>
        {incident.locked && (
          <span className="text-primary text-[11px]">🔒</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {incident.category && <CategoryBadge category={incident.category} />}
        <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
        {showPatternLabel && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-primary/70 border border-primary/15 bg-primary/[0.04]">
            <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 8a6 6 0 0 1 6-6v0a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6v0" strokeLinecap="round"/><path d="M8 14a6 6 0 0 1-6-6" strokeLinecap="round" strokeDasharray="2 3"/></svg>
            Repeated
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
