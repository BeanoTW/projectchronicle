import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CanonicalRecordMutationSchema,
  ContractEnvelopeSchema,
  EventDateValueSchema,
  MigrationPlanResultSchema,
  MigrationRowOutcomeSchema,
  V2DerivedObjectSchema,
  V2MediaSchema,
  V2ProposalSchema,
  V2RecordRelationshipSchema,
  V2RecordSchema,
} from '@/chronicle/model/contracts';
import { planMigration } from '@/chronicle/model/migrationPlan';
import { legacySnapshot } from '@/chronicle/model/fixtures/legacyArchaeologyFixtures';
import {
  CANONICAL_CONTRACT_VERSION,
  DERIVATION_CONTRACT_VERSION,
  V2_SCHEMA_VERSION,
} from '@/chronicle/model/schema';

const at = '2026-08-23T12:00:00.000Z';

const validRecord = () => ({
  id: 'record-1',
  owner_id: 'owner-1',
  kind: 'incident',
  schema_version: V2_SCHEMA_VERSION,
  original: { text: 'Exact original wording.', source: 'written', media_ids: [], sealed_at: at },
  details: {
    title: null,
    category_id: null,
    context: null,
    person_ids: [],
    location: null,
    event_date: { kind: 'exact', date: '2026-08-23' },
    event_time: '12:00',
    revision_count: 0,
  },
  lifecycle: { state: 'sealed' },
  dossier: { state: 'not_included' },
  captured_at: at,
  sealed_at: at,
  created_at: at,
  updated_at: at,
  sync: { remote_version: null, local_revision: 0, state: { state: 'local_only' }, last_attempt_at: null },
});

describe('Phase 1 — canonical contracts', () => {
  it('validates a sealed record and stable version envelope', () => {
    expect(V2RecordSchema.parse(validRecord()).original.text).toBe('Exact original wording.');
    expect(ContractEnvelopeSchema.parse({
      contract_version: CANONICAL_CONTRACT_VERSION,
      schema_version: V2_SCHEMA_VERSION,
      payload: validRecord(),
    }).schema_version).toBe(V2_SCHEMA_VERSION);
  });

  it('cannot express an original-content update through the mutation contract', () => {
    const detailsMutation = {
      kind: 'update_details',
      owner_id: 'owner-1',
      record_id: 'record-1',
      expected_revision: 0,
      patch: { title: 'A useful title' },
    };
    expect(CanonicalRecordMutationSchema.safeParse(detailsMutation).success).toBe(true);
    expect(CanonicalRecordMutationSchema.safeParse({
      ...detailsMutation,
      patch: { title: 'A useful title', original: { text: 'Rewritten' } },
    }).success).toBe(false);
    expect(CanonicalRecordMutationSchema.safeParse({
      ...detailsMutation,
      original: { text: 'Rewritten' },
    }).success).toBe(false);
  });

  it('requires the record seal and immutable original seal to agree', () => {
    const record = validRecord();
    record.original.sealed_at = '2026-08-23T12:01:00.000Z';
    expect(V2RecordSchema.safeParse(record).success).toBe(false);
  });

  it('round-trips honest date forms and rejects reversed ranges', () => {
    const values = [
      { kind: 'exact', date: '2026-08-23' },
      { kind: 'approximate', date: '2026-08-23', daypart: 'afternoon' },
      { kind: 'range', start: '2026-08-20', end: '2026-08-23' },
      { kind: 'unknown' },
    ];
    values.forEach(value => expect(EventDateValueSchema.safeParse(value).success).toBe(true));
    expect(EventDateValueSchema.safeParse({ kind: 'range', start: '2026-08-24', end: '2026-08-23' }).success).toBe(false);
    expect(EventDateValueSchema.safeParse({ kind: 'exact', date: '2026-02-30' }).success).toBe(false);
  });

  it('keeps unresolved legacy media honest', () => {
    const media = {
      id: 'media-1', record_id: 'record-1', owner_id: 'owner-1', kind: 'image',
      role: 'legacy_unresolved', name: 'photo.jpg', mime: 'image/jpeg', size: 10,
      duration_ms: null, description: null, added_at: at,
      inclusion: { state: 'included' },
      storage: { location: 'remote_only', remote_path: 'owner-1/photo.jpg' },
      content_hash: null,
      sync: { remote_version: 1, local_revision: 1, state: { state: 'synced', at, remote_version: 1 }, last_attempt_at: at },
    };
    expect(V2MediaSchema.parse(media).role).toBe('legacy_unresolved');
  });

  it('keeps proposals, relationships and derivations non-authoritative and versioned', () => {
    const proposal = {
      id: 'proposal-1', owner_id: 'owner-1', record_id: 'record-1', kind: 'category',
      proposed_value: 'workplace', source: { helper: 'input-helper', helper_version: '1', model: null },
      created_at: at, state: { state: 'proposed' },
    };
    expect(V2ProposalSchema.safeParse(proposal).success).toBe(true);
    expect(V2ProposalSchema.safeParse({ ...proposal, state: { state: 'accepted' } }).success).toBe(false);
    expect(V2ProposalSchema.safeParse({
      ...proposal, state: { state: 'accepted', resolved_at: at },
    }).success).toBe(false);

    expect(V2RecordRelationshipSchema.safeParse({
      id: 'relationship-1', owner_id: 'owner-1', record_id: 'record-1',
      entity_type: 'organisation', entity_id: 'organisation-1', role_note: null,
      source: 'accepted_proposal', created_at: at, removed_at: null,
    }).success).toBe(true);

    expect(V2DerivedObjectSchema.safeParse({
      id: 'derived-1', owner_id: 'owner-1', record_id: 'record-1', kind: 'embedding',
      source_record_version: 3, derivation_version: DERIVATION_CONTRACT_VERSION,
      created_at: at, value: [0.1, 0.2],
    }).success).toBe(true);
    expect(V2DerivedObjectSchema.safeParse({
      id: 'derived-1', owner_id: 'owner-1', record_id: 'record-1', kind: 'embedding',
      source_record_version: 3, derivation_version: DERIVATION_CONTRACT_VERSION + 1,
      created_at: at, value: [0.1, 0.2],
    }).success).toBe(false);
  });

  it('assigns exactly one validated outcome to every legacy source row', () => {
    const result = planMigration(legacySnapshot, { now: at });
    const expected = legacySnapshot.incidents.length + legacySnapshot.notes.length
      + legacySnapshot.evidence.length + legacySnapshot.history.length;

    expect(result.rowOutcomes).toHaveLength(expected);
    expect(MigrationPlanResultSchema.safeParse(result).success).toBe(true);
    expect(new Set(result.rowOutcomes.map(row => `${row.source}:${row.source_id}`)).size).toBe(expected);
    result.rowOutcomes.forEach(row => expect(MigrationRowOutcomeSchema.safeParse(row).success).toBe(true));
    expect(result.rowOutcomes).toContainEqual(expect.objectContaining({
      source: 'evidence', source_id: 'evidence-orphan', disposition: 'retained_unlinked',
    }));
  });

  it('keeps adapter ports free of storage implementations', () => {
    const source = readFileSync('src/chronicle/model/adapters.ts', 'utf8');
    expect(source).not.toMatch(/dexie|supabase|indexeddb|@\/local|@\/hooks/i);
    expect(source).not.toMatch(/class\s+.*Adapter|function\s+.*Adapter/);
  });
});
