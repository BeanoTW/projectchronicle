// Phase 6C route switch: V1 capture vs migrated V2 capture.
// Flip `v2Capture` in src/lib/featureFlags.ts (or ?ff=v2Capture:1).
// Independent of `v2Notebook`, `v2Entry` and `v2Dossier`.
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import RecordScreen from '@/pages/RecordScreen';
import CaptureScreenV2 from '@/pages/CaptureScreenV2';

const RecordRoute = () => {
  const v2 = useFeatureFlag('v2Capture');
  return v2 ? <CaptureScreenV2 /> : <RecordScreen />;
};

export default RecordRoute;
