import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { Incident } from '@/hooks/useIncidents';
import SeverityBadge from './SeverityBadge';
import CategoryBadge from './CategoryBadge';
import RecordAgeChip from './RecordAgeChip';

interface IncidentCardProps {
  incident: Incident;
}

const severityBorderColor: Record<string, string> = {
  Critical: 'border-l-severity-critical',
  Serious: 'border-l-severity-serious',
  Moderate: 'border-l-severity-moderate',
  Low: 'border-l-severity-low',
};

const IncidentCard = ({ incident }: IncidentCardProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/incident/${incident.id}`)}
      className={`w-full text-left bg-card rounded-lg border border-border p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 ${
        incident.severity ? severityBorderColor[incident.severity] : 'border-l-border'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground line-clamp-1 flex-1">
          {incident.title || 'Untitled incident'}
        </h3>
        {incident.locked && (
          <span className="ml-2 text-primary">🔒</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {incident.severity && <SeverityBadge severity={incident.severity} />}
        {incident.category && <CategoryBadge category={incident.category} />}
        <RecordAgeChip incidentDate={incident.incident_date} createdAt={incident.created_at} />
      </div>

      <p className="text-xs text-body line-clamp-2 mb-2">
        {incident.ai_summary || incident.raw_narrative}
      </p>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{format(parseISO(incident.incident_date), 'dd MMM yyyy')}</span>
        {incident.location && (
          <>
            <span>·</span>
            <span>{incident.location}</span>
          </>
        )}
      </div>
    </button>
  );
};

export default IncidentCard;
