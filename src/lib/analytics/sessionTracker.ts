/**
 * Retention tracking. Fires `return_session` and `consecutive_day_usage` at
 * most once per browser-session / per UTC-day respectively.
 */
import { analytics } from './analytics';

const KEY_LAST_SEEN_DAY = 'pc_analytics_last_seen_day';
const KEY_STREAK = 'pc_analytics_streak';
const KEY_LAST_SESSION = 'pc_analytics_last_session_at';
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

const todayKey = () => new Date().toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);

let started = false;

export function startSessionTracking(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  try {
    const now = Date.now();
    const lastSession = Number(localStorage.getItem(KEY_LAST_SESSION) || 0);
    if (lastSession && now - lastSession > SESSION_GAP_MS) {
      analytics.track('return_session');
    }
    localStorage.setItem(KEY_LAST_SESSION, String(now));

    const today = todayKey();
    const lastDay = localStorage.getItem(KEY_LAST_SEEN_DAY);
    let streak = Number(localStorage.getItem(KEY_STREAK) || 0);
    if (lastDay !== today) {
      if (lastDay && dayDiff(lastDay, today) === 1) streak += 1;
      else streak = 1;
      localStorage.setItem(KEY_LAST_SEEN_DAY, today);
      localStorage.setItem(KEY_STREAK, String(streak));
      if (streak >= 2) {
        analytics.track('consecutive_day_usage', { streak_days: streak });
      }
    }
  } catch {
    /* storage unavailable — ignore */
  }
}
