import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import CategoryBadge from './CategoryBadge';
import RecordAgeChip from './RecordAgeChip';

interface IncidentCardProps {
  incident: Incident;
  showPatternLabel?: boolean;
  compact?: boolean;
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

const IncidentCard = ({ incident, showPatternLabel, compact }: IncidentCardProps) => {
  const navigate = useNavigate();
  const tint = incident.category ? categoryCardTints[incident.category] || '' : '';

  if (compact) {
    return (
      <button
        onClick={() => navigate(`/incident/${incident.id}`)}
        className={`w-full text-left rounded-xl border border-border border-l-[3px] px-3.5 py-3 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-150 active:scale-[0.99] ${tint}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground line-clamp-1 flex-1 leading-snug">
            {incident.title || 'Untitled incident'}
          </h3>
          <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
            {format(parseISO(incident.incident_date), 'dd MMM')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          {incident.category && <CategoryBadge category={incident.category} />}
          {showPatternLabel && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-warm-accent-light text-warm-accent-foreground border border-warm-accent/15">
              Repeated
            </span>
          )}
          {incident.locked && <span className="text-primary text-[11px]">🔒</span>}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate(`/incident/${incident.id}`)}
      className={`w-full text-left rounded-xl border border-border border-l-[3px] p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-150 active:scale-[0.99] ${tint}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[14px] font-semibold text-foreground line-clamp-1 flex-1 leading-snug">
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
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-warm-accent-light text-warm-accent-foreground border border-warm-accent/15">
            Repeated behaviour
          </span>
        )}
      </div>

      <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mb-2.5">
        {incident.ai_summary || incident.raw_narrative}
      </p>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
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
