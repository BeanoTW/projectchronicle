import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB, type LocalIncident } from '@/local/db';
import {
  CanonicalImmutableConflictError,
  CanonicalLifecycleError,
  CanonicalRevisionConflictError,
  createCanonicalLocalRepository,
} from '@/chronicle/model/canonicalLocalRepository';
import type { V2Clarification, V2Media, V2RecordEvent } from '@/chronicle/model/schema';

const sealedAt = '2026-08-23T20:00:00.000Z';
const changedAt = '2026-08-23T20:01:00.000Z';

const sealInput = () => ({
  id: 'record-1',
  owner_id: 'owner-1',
  kind: 'incident' as const,
  original: {
    text: '  Exact original wording.  ',
    source: 'written' as const,
    media_ids: [],
    sealed_at: sealedAt,
  },
  captured_at: '2026-08-23T19:59:00.000Z',
  sealed_at: sealedAt,
});

const sync = {
  remote_version: null,
  local_revision: 0,
  state: { state: 'local_only' as const },
  last_attempt_at: null,
};

const legacyRow = {
  id: 'legacy-1', user_id: 'owner-1', owner_user_id: 'owner-1', raw_narrative: 'Legacy',
  record_type: 'incident', incident_date: '2026-08-20', record_date: null, incident_time: null,
  category: null, context_domain: null, location: null, title: null, excluded_from_rep: false,
  created_at: sealedAt, original_created_at: null, updated_at: sealedAt, last_modified_at: null,
  local_updated_at: sealedAt, sync_state: 'local_only', last_sync_attempt_at: null, last_sync_error: null,
  version: 1, voided_at: null, void_reason: null,
} as unknown as LocalIncident;

describe('Phase 3 — canonical local repository', () => {
  let db: ChronicleDB;
  let repository: ReturnType<typeof createCanonicalLocalRepository>;

  beforeEach(() => {
    db = new ChronicleDB(`chronicle_phase3_${crypto.randomUUID()}`);
    repository = createCanonicalLocalRepository(db, () => changedAt);
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('creates empty parallel canonical stores without copying legacy rows', async () => {
    await db.incidents.add(legacyRow);
    expect(await db.incidents.count()).toBe(1);
    expect(await db.canonical_records.count()).toBe(0);
    expect(await db.canonical_clarifications.count()).toBe(0);
    expect(await db.canonical_media.count()).toBe(0);
    expect(await db.canonical_history.count()).toBe(0);
  });

  it('seals verbatim, permits an exact retry, and rejects replacement original content', async () => {
    const input = sealInput();
    const first = await repository.seal(input);
    const retry = await repository.seal(input);

    expect(first.original.text).toBe('  Exact original wording.  ');
    expect(retry).toEqual(first);
    expect(await db.canonical_records.count()).toBe(1);

    await expect(repository.seal({
      ...input,
      original: { ...input.original, text: 'Rewritten wording' },
    })).rejects.toBeInstanceOf(CanonicalImmutableConflictError);

    expect((await repository.get('owner-1', input.id))?.original.text)
      .toBe('  Exact original wording.  ');
  });

  it('updates organisational details with optimistic revision protection and never touches original', async () => {
    await repository.seal(sealInput());
    const updated = await repository.updateDetails('owner-1', 'record-1', 0, {
      title: 'Useful title',
      context: 'Workplace meeting',
      event_date: { kind: 'approximate', date: '2026-08-22', daypart: 'afternoon' },
    });

    expect(updated.details.revision_count).toBe(1);
    expect(updated.details.title).toBe('Useful title');
    expect(updated.updated_at).toBe(changedAt);
    expect(updated.original.text).toBe('  Exact original wording.  ');
    expect(updated.sync.state).toEqual({ state: 'local_only' });
    expect(updated.sync.local_revision).toBe(1);

    await expect(repository.updateDetails('owner-1', 'record-1', 0, { title: 'Stale write' }))
      .rejects.toBeInstanceOf(CanonicalRevisionConflictError);
    expect((await repository.get('owner-1', 'record-1'))?.details.title).toBe('Useful title');
  });

  it('keeps owner-scoped reads isolated and deterministic', async () => {
    await repository.seal(sealInput());
    await repository.seal({ ...sealInput(), id: 'a-record' });
    await repository.seal({ ...sealInput(), id: 'other-record', owner_id: 'owner-2' });

    expect(await repository.get('owner-2', 'record-1')).toBeNull();
    expect((await repository.list('owner-1')).map(row => row.id)).toEqual(['a-record', 'record-1']);
    expect((await repository.list('owner-2')).map(row => row.id)).toEqual(['other-record']);
  });

  it('changes My Record membership without changing canonical wording', async () => {
    await repository.seal(sealInput());
    await repository.setDossierMembership('owner-1', 'record-1', {
      state: 'included', included_at: changedAt,
    });

    const record = await repository.get('owner-1', 'record-1');
    expect(record?.dossier).toEqual({ state: 'included', included_at: changedAt });
    expect(record?.original.text).toBe('  Exact original wording.  ');
    expect(record?.sync.local_revision).toBe(1);
  });

  it('appends clarifications, later media and history idempotently but rejects id collisions', async () => {
    await repository.seal(sealInput());

    const clarification: V2Clarification = {
      id: 'clarification-1', record_id: 'record-1', owner_id: 'owner-1', kind: 'clarification',
      text: 'Remembered afterwards.', created_at: changedAt, sync,
    };
    const media: V2Media = {
      id: 'media-1', record_id: 'record-1', owner_id: 'owner-1', kind: 'image', role: 'later',
      name: 'photo.jpg', mime: 'image/jpeg', size: 123, duration_ms: null, description: null,
      added_at: changedAt, inclusion: { state: 'included' }, storage: { location: 'local', ok: true },
      content_hash: 'sha256-test', sync,
    };
    const history: V2RecordEvent = {
      id: 'history-1', record_id: 'record-1', owner_id: 'owner-1', at: changedAt,
      action: 'clarification_added', field: null, from_value: null, to_value: null, actor: 'user',
    };

    await repository.appendClarification(clarification);
    await repository.appendClarification(clarification);
    await repository.appendMedia(media);
    await repository.appendMedia(media);
    await repository.appendHistory(history);
    await repository.appendHistory(history);

    expect(await db.canonical_clarifications.count()).toBe(1);
    expect(await db.canonical_media.count()).toBe(1);
    expect(await db.canonical_history.count()).toBe(1);

    await expect(repository.appendClarification({ ...clarification, text: 'Different text' }))
      .rejects.toBeInstanceOf(CanonicalImmutableConflictError);
    await expect(repository.appendMedia({ ...media, name: 'different.jpg' }))
      .rejects.toBeInstanceOf(CanonicalImmutableConflictError);
    await expect(repository.appendHistory({ ...history, actor: 'system' }))
      .rejects.toBeInstanceOf(CanonicalImmutableConflictError);
  });

  it('cannot append media as original after the record has already been sealed', async () => {
    await repository.seal(sealInput());
    const media: V2Media = {
      id: 'media-original', record_id: 'record-1', owner_id: 'owner-1', kind: 'image', role: 'original',
      name: 'capture.jpg', mime: 'image/jpeg', size: 123, duration_ms: null, description: null,
      added_at: sealedAt, inclusion: { state: 'included' }, storage: { location: 'local', ok: true },
      content_hash: 'sha256-original', sync,
    };

    await expect(repository.appendMedia(media)).rejects.toBeInstanceOf(CanonicalImmutableConflictError);
    expect(await db.canonical_media.count()).toBe(0);
  });

  it('refuses content mutations once a canonical record is archived', async () => {
    const record = await repository.seal(sealInput());
    await db.canonical_records.put({
      ...record,
      lifecycle: { state: 'archived', archived_at: changedAt, reason: 'Test archive' },
    });

    await expect(repository.updateDetails('owner-1', 'record-1', 0, { title: 'Should fail' }))
      .rejects.toBeInstanceOf(CanonicalLifecycleError);
    await expect(repository.setDossierMembership('owner-1', 'record-1', { state: 'not_included' }))
      .rejects.toBeInstanceOf(CanonicalLifecycleError);
  });
});
