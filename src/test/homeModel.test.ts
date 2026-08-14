import { describe, it, expect } from 'vitest';
import { buildHomeState } from '@/chronicle/shared/homeModel';
import type { LocalIncident } from '@/local/db';

const rec = (over: Partial<LocalIncident>): LocalIncident => ({
  id: 'r1',
  title: 'Meeting',
  raw_narrative: 'What happened',
  incident_date: '2026-08-01',
  record_date: null,
  created_at: '2026-08-01T09:00:00.000Z',
  original_created_at: '2026-08-01T09:00:00.000Z',
  excluded_from_rep: false,
  owner_user_id: 'u1',
  sync_state: 'backed_up',
  last_sync_attempt_at: null,
  last_sync_error: null,
  local_updated_at: '2026-08-01T09:00:00.000Z',
  ...over,
} as unknown as LocalIncident);

describe('Home state', () => {
  it('is a first-use state with no records', () => {
    const s = buildHomeState({ incidents: [], backupEnabled: true });
    expect(s.isFirstUse).toBe(true);
    expect(s.latest).toBeNull();
    expect(s.attention).toHaveLength(0);
  });

  it('surfaces the most recent record and Chronicle inclusion', () => {
    const s = buildHomeState({
      incidents: [
        rec({ id: 'old', original_created_at: '2026-07-01T09:00:00.000Z' }),
        rec({ id: 'new', title: 'Latest', original_created_at: '2026-08-10T09:00:00.000Z' }),
        rec({ id: 'excluded', excluded_from_rep: true }),
      ],
      backupEnabled: true,
      now: new Date('2026-08-13T00:00:00.000Z'),
    });
    expect(s.latest?.id).toBe('new');
    expect(s.latest?.inMyRecord).toBe(true);
    expect(s.recordCount).toBe(3);
    expect(s.inMyRecordCount).toBe(2);
    expect(s.recentCount).toBe(1);
    expect(s.isFirstUse).toBe(false);
  });

  it('reports only genuine attention states', () => {
    const s = buildHomeState({
      incidents: [rec({ sync_state: 'local_only' }), rec({ id: 'r2', sync_state: 'local_only' })],
      backupEnabled: false,
    });
    expect(s.attention.map(a => a.kind)).toEqual(['backup_off']);
    expect(s.attention[0].label).toContain('2 records');
  });

  it('flags conflicts and failed backups separately', () => {
    const s = buildHomeState({
      incidents: [rec({ sync_state: 'conflict' }), rec({ id: 'r2', sync_state: 'backup_failed' })],
      backupEnabled: true,
    });
    expect(s.attention.map(a => a.kind)).toEqual(['conflict', 'backup_failed']);
  });

  it('adds no attention noise for a healthy backed-up account', () => {
    const s = buildHomeState({ incidents: [rec({})], backupEnabled: true });
    expect(s.attention).toHaveLength(0);
  });
});
