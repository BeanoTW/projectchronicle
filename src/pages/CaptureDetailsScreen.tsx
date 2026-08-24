// Phase 6C — optional "Add details" step for a sealed production record.
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useIncident } from '@/hooks/useIncidents';
import { useAuth } from '@/contexts/AuthContext';
import { readCanonicalEntryBundle } from '@/chronicle/model/canonicalEntryReader';
import ReviewView from '@/chronicle/shared/ReviewView';
import { useProductionCaptureAdapter } from '@/chronicle/shared/productionCaptureAdapter';
import AppSurface from '@/chronicle/shared/AppSurface';
import '@/chronicle/styles.css';

const CaptureDetailsScreenV2 = () => {
  // V2 owns navigation on this surface; the legacy V1 bottom nav is not mounted.
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const adapter = useProductionCaptureAdapter();
  const { data: incident, isLoading } = useIncident(id);
  const canonical = useLiveQuery(
    async () => user?.id && id ? readCanonicalEntryBundle(user.id, id) : null,
    [user?.id, id],
  );
  const canonicalEntry = canonical?.source === 'canonical' ? canonical : null;

  if (isLoading && canonical === undefined) return <p className="proto-help">Loading…</p>;
  if (!incident && !canonicalEntry) {
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
            category: canonicalEntry ? canonicalEntry.record.details.category_id : incident?.category ?? null,
            context: canonicalEntry ? canonicalEntry.record.details.context : incident?.context_domain ?? null,
            people: canonicalEntry ? canonicalEntry.people.map(person => person.display_name) : incident?.people_involved ?? [],
            eventDate: canonicalEntry?.record.details.event_date?.kind === 'exact'
              ? canonicalEntry.record.details.event_date.date
              : incident?.incident_date ?? null,
            eventTime: canonicalEntry ? canonicalEntry.record.details.event_time : incident?.incident_time ?? null,
          }}
          onSave={async details => {
            const recordId = canonicalEntry?.record.id ?? incident!.id;
            await adapter.saveDetails(recordId, details);
            navigate(`/incident/${recordId}`);
          }}
          onSkip={() => navigate(`/incident/${canonicalEntry?.record.id ?? incident!.id}`)}
        />
      </div>
    </AppSurface>
  );
};

export default CaptureDetailsScreenV2;
