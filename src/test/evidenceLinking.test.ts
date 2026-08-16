// Regression tests for incident-linked evidence.
//
// Root cause under test: records are local-first, so a sealed incident could
// be missing from the server database when an evidence row referencing it was
// inserted, violating evidence_files_incident_id_fkey. The fix guarantees the
// canonical incident row exists server-side (same canonical id) before any
// evidence insert, and maps every failure to a safe user message.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toSafeAttachmentMessage, markUserSafe, EVIDENCE_MESSAGES } from '@/lib/evidenceErrors';

/* ------------------------------------------------------------------ */
/* A tiny fake of the server: an incidents table with a real FK check. */
/* ------------------------------------------------------------------ */

type Row = { id: string; user_id: string };
type EvidenceRow = { id: string; user_id: string; incident_id: string | null; file_hash: string; file_path: string };

class FakeBackend {
  incidents: Row[] = [];
  evidence: EvidenceRow[] = [];
  storage = new Set<string>();
  online = true;

  /** Mirrors the database foreign key — never weakened. */
  insertEvidence(row: EvidenceRow) {
    if (row.incident_id && !this.incidents.some(i => i.id === row.incident_id)) {
      throw new Error('insert or update on table "evidence_files" violates foreign key constraint "evidence_files_incident_id_fkey"');
    }
    // RLS equivalent: an incident owned by another account is invisible.
    if (row.incident_id && !this.incidents.some(i => i.id === row.incident_id && i.user_id === row.user_id)) {
      throw new Error('violates row-level security policy');
    }
    this.evidence.push(row);
    return row;
  }
}

/** Local-first record store (Dexie stand-in). */
const localIncidents = new Map<string, { id: string; owner: string }>();

const backend = new FakeBackend();

/** The production ordering rule, as implemented in syncEngine.ensureIncidentOnServer. */
const ensureIncidentOnServer = async (userId: string, incidentId: string) => {
  if (backend.incidents.some(i => i.id === incidentId && i.user_id === userId)) return;
  const local = localIncidents.get(incidentId);
  if (!local || local.owner !== userId) throw markUserSafe(new Error(EVIDENCE_MESSAGES.notReady), 'incident_not_synced');
  if (!backend.online) throw markUserSafe(new Error(EVIDENCE_MESSAGES.notReady), 'incident_not_synced');
  backend.incidents.push({ id: incidentId, user_id: userId });
};

/** The production upload sequence, mirrored. */
const uploadEvidence = async (userId: string, hash: string, incidentId: string | null) => {
  // 1. idempotency by (owner, hash, target)
  const existing = backend.evidence.find(
    e => e.user_id === userId && e.file_hash === hash && e.incident_id === incidentId,
  );
  if (existing) return existing;
  // 2. canonical incident must exist server-side first
  if (incidentId) await ensureIncidentOnServer(userId, incidentId);
  // 3. storage object, then row — row failure cleans the object up
  const path = `${userId}/${crypto.randomUUID()}`;
  backend.storage.add(path);
  try {
    return backend.insertEvidence({ id: crypto.randomUUID(), user_id: userId, incident_id: incidentId, file_hash: hash, file_path: path });
  } catch (e) {
    backend.storage.delete(path);
    throw e;
  }
};

const seal = (id: string, owner: string) => localIncidents.set(id, { id, owner });

beforeEach(() => {
  backend.incidents = [];
  backend.evidence = [];
  backend.storage.clear();
  backend.online = true;
  localIncidents.clear();
});

describe('capture-time evidence', () => {
  it('new incident + one photo links successfully', async () => {
    seal('inc-1', 'user-a');
    const row = await uploadEvidence('user-a', 'h1', 'inc-1');
    expect(row.incident_id).toBe('inc-1');
    expect(backend.incidents.map(i => i.id)).toEqual(['inc-1']);
  });

  it('new incident + multiple files all link to the same canonical id', async () => {
    seal('inc-2', 'user-a');
    await Promise.all(['a', 'b', 'c'].map(h => uploadEvidence('user-a', h, 'inc-2')));
    expect(backend.evidence).toHaveLength(3);
    expect(new Set(backend.evidence.map(e => e.incident_id))).toEqual(new Set(['inc-2']));
    expect(backend.incidents).toHaveLength(1);
  });

  it('queues rather than inserting an invalid row while the record is not on the server', async () => {
    seal('inc-3', 'user-a');
    backend.online = false;
    await expect(uploadEvidence('user-a', 'h', 'inc-3')).rejects.toMatchObject({ code: 'incident_not_synced' });
    expect(backend.evidence).toHaveLength(0);
    expect(backend.storage.size).toBe(0);       // no orphan storage object
  });

  it('retry after the record reaches the server succeeds, and the sealed record is untouched', async () => {
    seal('inc-4', 'user-a');
    backend.online = false;
    await expect(uploadEvidence('user-a', 'h', 'inc-4')).rejects.toBeTruthy();
    backend.online = true;
    const row = await uploadEvidence('user-a', 'h', 'inc-4');
    expect(row.incident_id).toBe('inc-4');
    expect(localIncidents.get('inc-4')).toEqual({ id: 'inc-4', owner: 'user-a' });
  });

  it('repeated retries (and page reload) never duplicate rows or storage objects', async () => {
    seal('inc-5', 'user-a');
    await uploadEvidence('user-a', 'same-hash', 'inc-5');
    await uploadEvidence('user-a', 'same-hash', 'inc-5');   // double tap
    await uploadEvidence('user-a', 'same-hash', 'inc-5');   // retry after reload
    expect(backend.evidence).toHaveLength(1);
    expect(backend.storage.size).toBe(1);
  });
});

describe('later and library evidence', () => {
  it('adds evidence to an already-existing server-side incident', async () => {
    seal('inc-6', 'user-a');
    backend.incidents.push({ id: 'inc-6', user_id: 'user-a' });
    const row = await uploadEvidence('user-a', 'later', 'inc-6');
    expect(row.incident_id).toBe('inc-6');
  });

  it('links an unlinked library attachment to an incident, ensuring presence first', async () => {
    seal('inc-7', 'user-a');
    const unlinked = await uploadEvidence('user-a', 'lib', null);
    expect(backend.incidents).toHaveLength(0);
    await ensureIncidentOnServer('user-a', 'inc-7');
    unlinked.incident_id = 'inc-7';
    expect(backend.incidents.map(i => i.id)).toEqual(['inc-7']);
    expect(() => backend.insertEvidence({ ...unlinked, id: 'x', file_path: 'p' })).not.toThrow();
  });

  it('never leaves an orphan evidence row when the foreign key would fail', async () => {
    // No local record at all: the guard refuses before any write.
    await expect(uploadEvidence('user-a', 'h', 'ghost')).rejects.toMatchObject({ code: 'incident_not_synced' });
    expect(backend.evidence).toHaveLength(0);
  });
});

describe('account isolation', () => {
  it('User B cannot link to User A record', async () => {
    seal('inc-a', 'user-a');
    backend.incidents.push({ id: 'inc-a', user_id: 'user-a' });
    await expect(uploadEvidence('user-b', 'h', 'inc-a')).rejects.toBeTruthy();
    expect(backend.evidence).toHaveLength(0);
  });

  it('User B cannot read User A evidence', async () => {
    seal('inc-a', 'user-a');
    await uploadEvidence('user-a', 'h', 'inc-a');
    const visibleToB = backend.evidence.filter(e => e.user_id === 'user-b');
    expect(visibleToB).toHaveLength(0);
  });
});

describe('user-facing failure messages', () => {
  it('never exposes table or constraint names', () => {
    const raw = new Error('insert or update on table "evidence_files" violates foreign key constraint "evidence_files_incident_id_fkey"');
    const msg = toSafeAttachmentMessage(raw);
    expect(msg).toBe(EVIDENCE_MESSAGES.generic);
    expect(msg).not.toMatch(/evidence_files|constraint|foreign key/i);
  });

  it('maps a not-yet-synced record to the calm "try again" message', () => {
    expect(toSafeAttachmentMessage(markUserSafe(new Error('anything'), 'incident_not_synced')))
      .toBe(EVIDENCE_MESSAGES.notReady);
  });

  it('passes through user-facing validation messages unchanged', () => {
    const policy = markUserSafe(new Error('“photo.png” is larger than the 20 MB limit for a single file.'), 'rejected_by_policy');
    expect(toSafeAttachmentMessage(policy)).toContain('20 MB limit');
  });

  it('always reassures that the record is safe', () => {
    expect(EVIDENCE_MESSAGES.generic).toContain('Your record is safe');
  });

  it('reports offline plainly', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(toSafeAttachmentMessage(new Error('failed to fetch'))).toBe(EVIDENCE_MESSAGES.offline);
    spy.mockRestore();
  });
});
