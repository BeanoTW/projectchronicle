import { useSyncExternalStore } from 'react';
import { isFeatureEnabled, isFullV2Enabled, subscribeToFlags, type FeatureFlag } from '@/lib/featureFlags';

/** Reactive read of a migration feature flag. */
export const useFeatureFlag = (flag: FeatureFlag): boolean =>
  useSyncExternalStore(
    subscribeToFlags,
    () => isFeatureEnabled(flag),
    () => false,
  );

/** True when every V2 route is enabled — used for navigation convergence. */
export const useFullV2 = (): boolean =>
  useSyncExternalStore(
    subscribeToFlags,
    () => isFullV2Enabled(),
    () => false,
  );
