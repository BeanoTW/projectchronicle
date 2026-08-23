import { describe, expect, it } from 'vitest';
import { projectLegacyIncident, projectLegacyIncidents } from '@/chronicle/model/legacyCompatibility';
import { V2RecordSchema } from '@/chronicle/model/contracts';
import type { LocalIncident } from '@/local/db';

const row = (patch: Record<string, unknown> = {}) => ({
  id: 'record-1',
  user_id: 'owner-1',
  owner_user_id: 'owner-1',
  raw_narrative: '  Exact wording stays exactly like this.  ',
  record_type: 'incident',
  incident_date: '2026-08-20',
  record_date: null,
  incident_time: '09:30',
  category: 'Workplace',
  context_domain: 'employment',
  location: 'Office',
  title: 'Meeting',
  excluded_from_rep: false,
  created_at: '2026-08-20T09:40:00.000Z',
  original_created_at: '2026-08-20T09:35:00.000Z',
  updated_at: '2026-08-20T10:00:00.000Z',
  last_modified_at: '2026-08-20T10:00:00.000Z',
  local_updated_at: '2026-08-20T10:00:00.000Z',
  sync_state: 'local_only',
  last_sync_attempt_at: null,
  last_sync_error: null,
  version: 1,
  voided_at: null,
  void_reason: null,
  ...patch,
}) as unknown as LocalIncident;

describe('Phase 2 — legacy compatibility projection', () => {
  it('projects without mutating or rewriting original wording', () => {
    const source = row();
    const before = JSON.stringify(source);
    const projected = projectLegacyIncident(source);
    expect(projected.original.text).toBe('  Exact wording stays exactly like this.  ');
    expect(projected.original.source).toBe('imported_v1');
    expect(JSON.stringify(source)).toBe(before);
    expect(V2RecordSchema.safeParse(projected).success).toBe(true);
  });

  it('does not invent precision for malformed legacy dates or times', () => {
    const projected = projectLegacyIncident(row({ incident_date: 'sometime in August', incident_time: 'morning-ish' }));
    expect(projected.details.event_date).toBeNull();
    expect(projected.details.event_time).toBeNull();
  });

  it('uses the daily record date and canonical daily kind', () => {
    const projected = projectLegacyIncident(row({ record_type: 'daily_record', incident_date: null, record_date: '2026-08-21' }));
    expect(projected.kind).toBe('daily');
    expect(projected.details.event_date).toEqual({ kind: 'exact', date: '2026-08-21' });
  });

  it('keeps legacy people unresolved rather than merging names into identities', () => {
    const projected = projectLegacyIncident(row({ people_involved: ['Alex Smith', 'alex smith'] }));
    expect(projected.details.person_ids).toEqual([]);
  });

  it('maps existing sync state without performing sync', () => {
    const projected = projectLegacyIncident(row({
      sync_state: 'conflict',
      version: 4,
      cloud_version: 5,
      conflict_detected_at: '2026-08-20T10:05:00.000Z',
    }));
    expect(projected.sync.state).toEqual({
      state: 'conflict', detected_at: '2026-08-20T10:05:00.000Z', remote_version: 5,
    });
  });

  it('enforces owner isolation and deterministic ordering', () => {
    const rows = [row({ id: 'z' }), row({ id: 'a' }), row({ id: 'other', owner_user_id: 'owner-2' })];
    expect(projectLegacyIncidents(rows, 'owner-1').map(item => item.id)).toEqual(['a', 'z']);
  });
});
