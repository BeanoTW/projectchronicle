import { useEffect } from 'react';
import { analytics, type AnalyticsEvent } from '@/lib/analytics/analytics';

/**
 * Fire `event` once per mount. Safe against React StrictMode double-mount via
 * the analytics in-memory dedupe set scoped to the session.
 */
export function useTrackScreenView(event: AnalyticsEvent): void {
  useEffect(() => {
    analytics.track(event);
    // intentionally no deps — once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
