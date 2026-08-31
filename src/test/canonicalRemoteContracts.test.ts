import { describe, expect, it } from 'vitest';
import {
  RemoteClarificationBodySchema,
  RemoteOrganisationSchema,
  RemotePersonSchema,
  RemoteRecordEventSchema,
  RemoteRelationshipSchema,
} from '@/chronicle/sync/canonicalRemoteContracts';

const at = '2026-08-26T04:00:00.000Z';

describe('canonical remote child contracts', () => {
  it('accepts the canonical organisation shape and rejects legacy/person-only fields', () => {
    const valid = {
      id: 'org-1', owner_id: 'owner-1', display_name: 'Example Ltd', normalised_name: 'example ltd',
      note: null, created_at: at, merged_into_id: null,
    };
    expect(RemoteOrganisationSchema.parse(valid)).toEqual(valid);
    expect(() => RemoteOrganisationSchema.parse({ ...valid, role_note: null })).toThrow();
  });

  it('rejects unknown fields on append-only person/history rows', () => {
    expect(() => RemotePersonSchema.parse({
      id: 'person-1', owner_id: 'owner-1', display_name: 'Alex', normalised_name: 'alex',
      role_note: null, created_at: at, merged_into_id: null, injected: true,
    })).toThrow();
    expect(() => RemoteRecordEventSchema.parse({
      id: 'history-1', record_id: 'record-1', owner_id: 'owner-1', at,
      action: 'sealed', field: null, from_value: null, to_value: null, actor: 'system', extra: 'nope',
    })).toThrow();
  });

  it('validates clarification correction targets and relationship entity types', () => {
    expect(() => RemoteClarificationBodySchema.parse({
      id: 'clar-1', record_id: 'record-1', owner_id: 'owner-1', kind: 'correction', text: 'Correction',
      created_at: at, corrects_field: 'made_up_field',
    })).toThrow();
    expect(() => RemoteRelationshipSchema.parse({
      id: 'rel-1', owner_id: 'owner-1', record_id: 'record-1', entity_type: 'company', entity_id: 'org-1',
      role_note: null, source: 'user', created_at: at, removed_at: null,
    })).toThrow();
  });
});
