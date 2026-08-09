// Phase 6C route switch for the optional post-seal details step.
// When `v2Capture` is off this path is not part of V1, so it falls back to the
// canonical record view.
import { Navigate, useParams } from 'react-router-dom';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import CaptureDetailsScreenV2 from '@/pages/CaptureDetailsScreenV2';

const CaptureDetailsRoute = () => {
  const v2 = useFeatureFlag('v2Capture');
  const { id } = useParams();
  if (!v2) return <Navigate to={id ? `/incident/${id}` : '/timeline'} replace />;
  return <CaptureDetailsScreenV2 />;
};

export default CaptureDetailsRoute;
