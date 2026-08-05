// Phase 6 route switch: V1 record detail vs migrated V2 record view.
// Flip `v2Entry` in src/lib/featureFlags.ts (or ?ff=v2Entry:1) to roll forward/back.
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import IncidentDetailScreen from '@/pages/IncidentDetailScreen';
import EntryScreenV2 from '@/pages/EntryScreenV2';

const RecordDetailRoute = () => {
  const v2 = useFeatureFlag('v2Entry');
  return v2 ? <EntryScreenV2 /> : <IncidentDetailScreen />;
};

export default RecordDetailRoute;
