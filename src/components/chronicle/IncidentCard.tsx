import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import CategoryBadge from './CategoryBadge';
import RecordAgeChip from './RecordAgeChip';

interface IncidentCardProps {
  incident: Incident;
  showPatternLabel?: boolean;
}

const IncidentCard = ({ incident, showPatternLabel }: IncidentCardProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/incident/${incident.id}`)}
      className="w-full text-left bg-card rounded-xl border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-200 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-[14px] font-semibold text-foreground line-clamp-1 flex-1">
          {incident.title || 'Untitled incident'}
        </h3>
        {incident.locked && (
          <span className="ml-2 text-primary text-xs">🔒</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {incident.category && <CategoryBadge category={incident.category} />}
        <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
        {showPatternLabel && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-warm-accent-light text-warm-accent-foreground border border-warm-accent/15">
            Repeated behaviour
          </span>
        )}
      </div>

      <p className="text-[13px] text-body leading-relaxed line-clamp-2 mb-2">
        {incident.ai_summary || incident.raw_narrative}
      </p>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{format(parseISO(incident.incident_date), 'dd MMM yyyy')}</span>
        {incident.location && (
          <>
            <span className="opacity-40">·</span>
            <span>{incident.location}</span>
          </>
        )}
      </div>
    </button>
  );
};

export default IncidentCard;
