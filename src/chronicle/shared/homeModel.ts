// Source-agnostic model for Home — Chronicle's control centre.
//
// Home is deliberately NOT an analytics dashboard. Every value below is a real
// state that already exists in the product and that a user can act on. Nothing
// here is invented to fill space: no charts, no streaks, no vanity counters.

import type { LocalIncident } from '@/local/db';

export interface HomeLatestRecord {
  id: string;
  title: string;
  /** Canonical event date, YYYY-MM-DD. */
  dateKey: string;
  /** Moment the record was sealed. */
  recordedAt: string;
  inMyRecord: boolean;
}

export type AttentionKind = 'not_backed_up' | 'backup_failed' | 'conflict' | 'backup_off';

export interface HomeAttention {
  kind: AttentionKind;
  label: string;
  detail: string;
  /** Route the user can go to in order to deal with it. */
  action: { label: string; path: string };
}

export interface HomeState {
  recordCount: number;
  /** Records currently included in My Record (production flag: !excluded_from_rep). */
  inMyRecordCount: number;
  latest: HomeLatestRecord | null;
  /** Records added in the last 7 days — context for "where you left off", not a statistic. */
  recentCount: number;
  attention: HomeAttention[];
  isFirstUse: boolean;
}

const firstLine = (text: string): string => {
  const line = (text ?? '').trim().split('\n').find(l => l.trim().length > 0) ?? '';
  return line.length > 72 ? `${line.slice(0, 69)}…` : line;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export interface HomeInput {
  incidents: LocalIncident[];
  backupEnabled: boolean;
  /** Now, injectable for deterministic tests. */
  now?: Date;
}

export const buildHomeState = ({ incidents, backupEnabled, now = new Date() }: HomeInput): HomeState => {
  const records = incidents ?? [];
  const recordCount = records.length;

  const sorted = [...records].sort((a, b) => {
    const av = a.original_created_at ?? a.created_at ?? '';
    const bv = b.original_created_at ?? b.created_at ?? '';
    return av < bv ? 1 : av > bv ? -1 : 0;
  });

  const newest = sorted[0];
  const latest: HomeLatestRecord | null = newest
    ? {
        id: newest.id,
        title: newest.title || firstLine(newest.raw_narrative) || 'Untitled record',
        dateKey:
          ((newest as { record_type?: string }).record_type === 'daily_record' ? newest.record_date : null) ??
          newest.incident_date ??
          (newest.created_at ?? '').slice(0, 10),
        recordedAt: newest.original_created_at ?? newest.created_at ?? '',
        inMyRecord: !newest.excluded_from_rep,
      }
    : null;

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentCount = records.filter(r => (r.original_created_at ?? r.created_at ?? '') >= weekAgo).length;

  const inMyRecordCount = records.filter(r => !r.excluded_from_rep).length;

  const attention: HomeAttention[] = [];
  const conflicts = records.filter(r => r.sync_state === 'conflict').length;
  const failed = records.filter(r => r.sync_state === 'backup_failed').length;
  const queued = records.filter(r => r.sync_state === 'queued').length;
  const localOnly = records.filter(r => r.sync_state === 'local_only').length;

  if (conflicts > 0) {
    attention.push({
      kind: 'conflict',
      label: `${conflicts} ${plural(conflicts, 'record needs', 'records need')} review`,
      detail: 'A newer version of this record exists elsewhere. Nothing has been overwritten.',
      action: { label: 'Review in Notebook', path: '/timeline' },
    });
  }
  if (failed > 0) {
    attention.push({
      kind: 'backup_failed',
      label: `${failed} ${plural(failed, 'record', 'records')} failed to back up`,
      detail: 'Your records are still safe on this device. Backup will be retried.',
      action: { label: 'Open Settings', path: '/settings' },
    });
  }
  if (backupEnabled && queued > 0 && failed === 0) {
    attention.push({
      kind: 'not_backed_up',
      label: `${queued} ${plural(queued, 'record is', 'records are')} waiting to back up`,
      detail: 'They will upload automatically when you are online.',
      action: { label: 'Open Settings', path: '/settings' },
    });
  }
  if (!backupEnabled && localOnly > 0) {
    attention.push({
      kind: 'backup_off',
      label: `${localOnly} ${plural(localOnly, 'record is', 'records are')} only on this device`,
      detail: 'Cloud backup is off. If this device is lost, these records are lost with it.',
      action: { label: 'Turn on backup', path: '/settings' },
    });
  }

  return {
    recordCount,
    inMyRecordCount,
    latest,
    recentCount,
    attention,
    isFirstUse: recordCount === 0,
  };
};

/** Neutral, factual date display used by Home tiles. */
export const formatHomeDate = (dateKey: string): string => {
  if (!dateKey) return '';
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatHomeTimestamp = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
