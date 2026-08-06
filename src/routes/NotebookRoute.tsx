// Phase 6B route switch: V1 Timeline vs migrated V2 Notebook.
// Flip `v2Notebook` in src/lib/featureFlags.ts (or ?ff=v2Notebook:1).
// Independent of `v2Entry` — records always open at /incident/:id.
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import TimelineScreen from '@/pages/TimelineScreen';
import NotebookScreenV2 from '@/pages/NotebookScreenV2';

const NotebookRoute = () => {
  const v2 = useFeatureFlag('v2Notebook');
  return v2 ? <NotebookScreenV2 /> : <TimelineScreen />;
};

export default NotebookRoute;
