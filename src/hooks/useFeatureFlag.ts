import { useSyncExternalStore } from 'react';
import { isFeatureEnabled, subscribeToFlags, type FeatureFlag } from '@/lib/featureFlags';

/** Reactive read of a migration feature flag. */
export const useFeatureFlag = (flag: FeatureFlag): boolean =>
  useSyncExternalStore(
    subscribeToFlags,
    () => isFeatureEnabled(flag),
    () => false,
  );
