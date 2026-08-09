// Phase 6D route switch: V1 Export/Reports vs migrated V2 Dossier.
// Flip `v2Dossier` in src/lib/featureFlags.ts (or ?ff=v2Dossier:1).
// Independent of v2Entry / v2Notebook / v2Capture — records always open at /incident/:id.
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import ExportScreen from '@/pages/ExportScreen';
import DossierScreenV2 from '@/pages/DossierScreenV2';

const ExportRoute = () => {
  const v2 = useFeatureFlag('v2Dossier');
  return v2 ? <DossierScreenV2 /> : <ExportScreen />;
};

export default ExportRoute;
