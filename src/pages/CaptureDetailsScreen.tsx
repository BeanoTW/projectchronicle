// Phase 6C — optional "Add details" step for a sealed production record.
// Behind the `v2Capture` flag; when the flag is off the route redirects to the
// canonical record so direct links and refreshes never break.
import { useNavigate, useParams } from 'react-router-dom';
import { useIncident } from '@/hooks/useIncidents';
import ReviewView from '@/chronicle/shared/ReviewView';
import { useProductionCaptureAdapter } from '@/chronicle/shared/productionCaptureAdapter';
import AppSurface from '@/chronicle/shared/AppSurface';
import '@/chronicle/styles.css';
import { useOwnNavigationV2 } from '@/components/chronicle/NavigationOwnership';

const CaptureDetailsScreenV2 = () => {
  // V2 owns navigation on this surface; the legacy V1 bottom nav is not mounted.
  useOwnNavigationV2();
  const { id } = useParams();
  const navigate = useNavigate();
  const adapter = useProductionCaptureAdapter();
  const { data: incident, isLoading } = useIncident(id);

  if (isLoading) return <p className="proto-help">Loading…</p>;
  if (!incident) {
    return (
      <AppSurface>
        <div className="proto-page">
          <p className="proto-help">That record could not be found on this device.</p>
          <button className="proto-btn" onClick={() => navigate('/timeline')}>Back to Notebook</button>
        </div>
      </AppSurface>
    );
  }

  return (
    <AppSurface>
      <div className="proto-page">
        <ReviewView
          initial={{
            category: incident.category,
            context: incident.context_domain,
            people: incident.people_involved ?? [],
            eventDate: incident.incident_date,
            eventTime: incident.incident_time,
          }}
          onSave={async details => {
            await adapter.saveDetails(incident.id, details);
            navigate(`/incident/${incident.id}`);
          }}
          onSkip={() => navigate(`/incident/${incident.id}`)}
        />
      </div>
    </AppSurface>
  );
};

export default CaptureDetailsScreenV2;
