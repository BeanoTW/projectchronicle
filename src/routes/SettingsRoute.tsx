// Phase 9 route switch: V1 Settings vs the V2 Settings surface.
// Flip `v2Settings` in src/lib/featureFlags.ts (or ?ff=v2Settings:1).
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import SettingsScreen from '@/pages/SettingsScreen';
import SettingsScreenV2 from '@/pages/SettingsScreenV2';

const SettingsRoute = () => {
  const v2 = useFeatureFlag('v2Settings');
  return v2 ? <SettingsScreenV2 /> : <SettingsScreen />;
};

export default SettingsRoute;
