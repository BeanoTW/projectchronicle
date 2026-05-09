/**
 * Project Chronicle — Lightweight product analytics.
 *
 * Privacy contract:
 *  - Event-based only. No raw narratives, no people names, no incident text,
 *    no category labels, no titles. Properties are aggregate/numeric/boolean.
 *  - User id (when available) is forwarded only to identify(); no PII otherwise.
 *  - No-op by default; if VITE_POSTHOG_KEY is present at runtime it lazy-loads
 *    posthog-js. Until then events are queued and emitted to console.debug.
 */

export type AnalyticsEvent =
  // Auth
  | 'account_created'
  | 'login_completed'
  // Activation
  | 'first_record_created'
  | 'record_completed'
  | 'daily_record_created'
  // Engagement
  | 'timeline_viewed'
  | 'calendar_viewed'
  | 'my_record_viewed'
  | 'export_builder_opened'
  // Exports
  | 'export_generated'
  | 'export_downloaded'
  | 'export_shared'
  | 'export_printed'
  // Retention
  | 'return_session'
  | 'consecutive_day_usage'
  // Optional features
  | 'privacy_shield_enabled'
  | 'ai_assist_used'
  | 'attachment_added';

type Props = Record<string, string | number | boolean | null | undefined>;

type Adapter = {
  identify: (userId: string) => void;
  reset: () => void;
  track: (event: AnalyticsEvent, props?: Props) => void;
};

const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? '';
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';

let adapter: Adapter | null = null;
let initPromise: Promise<void> | null = null;
let pendingId: string | null = null;
const queue: Array<{ event: AnalyticsEvent; props?: Props }> = [];

const consoleAdapter: Adapter = {
  identify: (id) => console.debug('[analytics] identify', id),
  reset: () => console.debug('[analytics] reset'),
  track: (event, props) => console.debug('[analytics] track', event, props ?? {}),
};

async function loadPostHog(): Promise<Adapter | null> {
  if (!POSTHOG_KEY) return null;
  try {
    // posthog-js is optional; loaded only if installed and key is set.
    const mod = await import(/* @vite-ignore */ ('posthog' + '-js'));
    const ph = (mod as { default?: unknown }).default ?? mod;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posthog = ph as any;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      persistence: 'localStorage',
    });
    return {
      identify: (id) => posthog.identify(id),
      reset: () => posthog.reset(),
      track: (event, props) => posthog.capture(event, props),
    };
  } catch {
    return null;
  }
}

function ensureInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const ph = await loadPostHog();
    adapter = ph ?? consoleAdapter;
    if (pendingId) adapter.identify(pendingId);
    while (queue.length) {
      const item = queue.shift()!;
      adapter.track(item.event, item.props);
    }
  })();
  return initPromise;
}

// Dedupe key cache for events that should fire at most once per session/day.
const sentOnce = new Set<string>();

export const analytics = {
  init(): void {
    void ensureInit();
  },
  identify(userId: string): void {
    pendingId = userId;
    if (adapter) adapter.identify(userId);
    else void ensureInit();
  },
  reset(): void {
    pendingId = null;
    sentOnce.clear();
    if (adapter) adapter.reset();
  },
  track(event: AnalyticsEvent, props?: Props): void {
    if (!adapter) {
      queue.push({ event, props });
      void ensureInit();
      return;
    }
    adapter.track(event, props);
  },
  /** Fire `event` at most once for the given dedupe key (in-memory). */
  trackOnce(key: string, event: AnalyticsEvent, props?: Props): void {
    if (sentOnce.has(key)) return;
    sentOnce.add(key);
    this.track(event, props);
  },
};
