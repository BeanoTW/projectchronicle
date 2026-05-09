/**
 * Supabase sink for analytics events. Writes aggregate, privacy-safe events
 * into the `analytics_events` table. Only numeric / boolean / short-string
 * properties are stored; any keys that look like content are stripped.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AnalyticsEvent } from './analytics';

const SESSION_KEY = 'pc_analytics_session_id';

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

// Allowlist of property keys that are safe to persist. Aggregate / metadata
// only — never narrative, names, locations, categories, titles, quotes.
const ALLOWED_KEYS = new Set([
  'streak_days',
  'record_method',
  'is_daily',
  'attempted',
  'succeeded',
  'failed',
  'count',
  'duration_ms',
  'has_attachments',
  'attachment_count',
  'screen',
  'export_format',
  'delivery',
  'shield_state',
  'ai_kind',
]);

function sanitize(props?: Record<string, unknown>): Record<string, unknown> {
  if (!props) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (v == null) continue;
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else if (typeof v === 'string' && v.length <= 32) {
      // Short categorical string only (e.g. 'voice', 'pdf', 'download')
      out[k] = v;
    }
  }
  return out;
}

export async function recordSupabaseEvent(
  event: AnalyticsEvent,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('analytics_events').insert([{
      event_name: event,
      user_id: user?.id ?? undefined,
      session_id: getSessionId(),
      props: sanitize(props) as never,
    }]);
  } catch {
    /* swallow — analytics must never break the app */
  }
}
