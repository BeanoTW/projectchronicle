import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB } from '@/local/db';
import { createCanonicalEntryWriter, CanonicalWriteNotActiveError } from '@/chronicle/model/canonicalEntryWriter';
import { createCanonicalLocalRepository, CanonicalRevisionConflictError } from '@/chronicle/model/canonicalLocalRepository';
import type { CanonicalActivationReceipt } from '@/chronicle/model/canonicalActivation';

const sealedAt = '2026-08-24T12:00:00.000Z';
const changedAt = '2026-08-24T12:05:00.000Z';
const receipt: CanonicalActivationReceipt = {
  version: 1, owner_id: 'owner-1', state: 'canonical', activated_at: sealedAt,
  counts: { records: 1, clarifications: 0, media: 0, history: 0, people: 0, relationships: 0 },
  inspected: { incidents: 1, notes: 0, evidence: 0, history: 0 },
};

const sealInput = () => ({
  id: 'record-1', owner_id: 'owner-1', kind: 'incident' as const,
  original: { text: 'Immutable wording', source: 'written' as const, media_ids: [], sealed_at: sealedAt },
  captured_at: sealedAt, sealed_at: sealedAt,
});

describe('Phase 9 — canonical entry writer', () => {
  let db: ChronicleDB;
  let repository: ReturnType<typeof createCanonicalLocalRepository>;
  let writer: ReturnType<typeof createCanonicalEntryWriter>;
  let id = 0;

  beforeEach(async () => {
    db = new ChronicleDB(`phase9_${crypto.randomUUID()}`);
    repository = createCanonicalLocalRepository(db, () => changedAt);
    await repository.seal(sealInput());
    writer = createCanonicalEntryWriter(db, async ownerId => ownerId === 'owner-1' ? receipt : null, () => changedAt, () => `generated-${++id}`);
  });

  afterEach(async () => { db.close(); await db.delete(); });

  it('blocks writes without canonical activation', async () => {
    const inactive = createCanonicalEntryWriter(db, async () => null, () => changedAt, () => 'id');
    await expect(inactive.addClarification('owner-1', 'record-1', 'Context')).rejects.toBeInstanceOf(CanonicalWriteNotActiveError);
    expect(await db.canonical_clarifications.count()).toBe(0);
  });

  it('writes clarification and history in one successful mutation', async () => {
    await writer.addClarification('owner-1', 'record-1', '  Remembered later.  ');
    const clarification = await db.canonical_clarifications.toArray();
    const history = await db.canonical_history.toArray();
    expect(clarification).toHaveLength(1);
    expect(clarification[0].text).toBe('Remembered later.');
    expect(history.filter(row => row.action === 'clarification_added')).toHaveLength(1);
  });

  it('updates Chronicle membership and history atomically without touching original wording', async () => {
    await writer.setChronicleMembership('owner-1', 'record-1', true);
    const record = await repository.get('owner-1', 'record-1');
    expect(record?.dossier.state).toBe('included');
    expect(record?.original.text).toBe('Immutable wording');
    expect((await db.canonical_history.toArray()).filter(row => row.action === 'dossier_included')).toHaveLength(1);
  });

  it('updates organisational details, preserves uncertainty and records each changed field', async () => {
    const before = (await repository.get('owner-1', 'record-1'))!;
    const next = await writer.updateDetails('owner-1', before, {
      title: 'Meeting note',
      event_date: { kind: 'approximate', date: '2026-08-20', daypart: 'morning' },
      event_time: null,
    });
    expect(next.details.revision_count).toBe(1);
    expect(next.details.event_date).toEqual({ kind: 'approximate', date: '2026-08-20', daypart: 'morning' });
    expect(next.original.text).toBe('Immutable wording');
    expect((await db.canonical_history.toArray()).filter(row => row.action === 'details_updated').map(row => row.field)).toEqual(['event_date', 'title']);
  });

  it('rejects stale detail writes without partial history', async () => {
    const stale = (await repository.get('owner-1', 'record-1'))!;
    await writer.updateDetails('owner-1', stale, { title: 'First' });
    const historyBefore = await db.canonical_history.count();
    await expect(writer.updateDetails('owner-1', stale, { title: 'Stale' })).rejects.toBeInstanceOf(CanonicalRevisionConflictError);
    expect(await db.canonical_history.count()).toBe(historyBefore);
    expect((await repository.get('owner-1', 'record-1'))?.details.title).toBe('First');
  });

  it('keeps clarification meaning while a correction remains additive', async () => {
    await writer.addClarification('owner-1', 'record-1', 'The meeting was Tuesday, not Monday.', 'correction');
    const clarification = (await db.canonical_clarifications.toArray())[0];
    expect(clarification.kind).toBe('correction');
    expect((await repository.get('owner-1', 'record-1'))?.original.text).toBe('Immutable wording');
  });

  it('does not create history or revisions for unchanged actions', async () => {
    const record = (await repository.get('owner-1', 'record-1'))!;
    const historyBefore = await db.canonical_history.count();
    const unchanged = await writer.updateDetails('owner-1', record, { title: null, event_time: null });
    await writer.setChronicleMembership('owner-1', record.id, false);
    expect(unchanged.details.revision_count).toBe(0);
    expect(await db.canonical_history.count()).toBe(historyBefore);
  });

  it('records archive and restore once without changing original wording', async () => {
    await writer.archive('owner-1', 'record-1', 'Finished for now');
    await writer.archive('owner-1', 'record-1', 'Finished for now');
    await writer.restore('owner-1', 'record-1');
    await writer.restore('owner-1', 'record-1');
    const record = await repository.get('owner-1', 'record-1');
    expect(record?.lifecycle.state).toBe('sealed');
    expect(record?.original.text).toBe('Immutable wording');
    expect((await db.canonical_history.toArray()).filter(row => row.action === 'archived')).toHaveLength(1);
    expect((await db.canonical_history.toArray()).filter(row => row.action === 'restored')).toHaveLength(1);
  });
});
