import { V2_BASE } from '../routes';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v2DB, type V2Entry } from '../db';
import EvidenceSection from '../media/EvidenceSection';
import ReviewView from '../shared/ReviewView';
import { previewCaptureAdapter } from '../shared/previewCaptureAdapter';

/** Chronicle V2 (candidate) review — shared view over the preview adapter. */
const ReviewScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<V2Entry | null>(null);

  useEffect(() => {
    if (!id) return;
    v2DB.entries.get(id).then(e => { if (e) setEntry(e); });
  }, [id]);

  if (!entry) return <p className="proto-help">Loading…</p>;

  return (
    <ReviewView
      initial={{
        category: entry.category,
        context: entry.context,
        people: entry.people,
        eventDate: entry.event_date,
        eventTime: entry.event_time,
      }}
      onSave={async details => {
        await previewCaptureAdapter.saveDetails(entry.id, details);
        navigate(`${V2_BASE}/entry/${entry.id}`);
      }}
      onSkip={() => navigate(V2_BASE + '/notebook')}
    >
      <EvidenceSection entryId={entry.id} />
    </ReviewView>
  );
};

export default ReviewScreen;
