/**
 * Local device account isolation.
 *
 * Chronicle is local-first: records live in one shared IndexedDB database
 * (`chronicle_local`) with an `owner_user_id` column. Every application read
 * is already owner-scoped, but the *bytes* of user A's narrative stayed in the
 * live tables after sign-out. On a shared computer that is not acceptable.
 *
 * Strategy adopted (model B + quarantine):
 *
 *   On every account boundary (A → B, or A → signed out):
 *     - rows belonging to the departing account that are confirmed
 *       `backed_up` are DELETED locally. They are recoverable from the
 *       backend, so nothing is lost.
 *     - rows that are NOT safely backed up (local_only / queued /
 *       backup_failed / conflict) are MOVED into a `quarantine` table and
 *       removed from the live tables. Quarantined rows are never returned by
 *       any application query, so the next account cannot see them, and they
 *       are not deleted, so nothing is silently lost.
 *
 *   When an account signs in, its own quarantined rows are restored into the
 *   live tables automatically.
 *
 * This gives isolation without ever risking unsynced data.
 */
import { localDB, type LocalIncident, type LocalFollowUpNote } from './db';

export type QuarantineKind = 'incident' | 'note';

/** Sync states that mean "the backend has this row" — safe to drop locally. */
const SAFE_TO_DROP = new Set(['backed_up']);

const qKey = (kind: QuarantineKind, id: string) => `${kind}:${id}`;

/** Number of rows for a user that are NOT safely backed up. */
export const countUnsyncedFor = async (userId: string): Promise<number> => {
  if (!userId) return 0;
  const [incidents, notes] = await Promise.all([
    localDB.incidents.where('owner_user_id').equals(userId).toArray(),
    localDB.follow_up_notes.where('owner_user_id').equals(userId).toArray(),
  ]);
  return [...incidents, ...notes].filter(r => !SAFE_TO_DROP.has(r.sync_state)).length;
};

/**
 * Clears a departing account's content out of the live tables.
 * Returns how many rows were dropped and how many were preserved in quarantine.
 */
export const quarantineUserData = async (
  userId: string,
): Promise<{ dropped: number; quarantined: number }> => {
  if (!userId) return { dropped: 0, quarantined: 0 };

  const [incidents, notes] = await Promise.all([
    localDB.incidents.where('owner_user_id').equals(userId).toArray(),
    localDB.follow_up_notes.where('owner_user_id').equals(userId).toArray(),
  ]);

  let dropped = 0;
  let quarantined = 0;

  await localDB.transaction('rw', localDB.incidents, localDB.follow_up_notes, localDB.quarantine, async () => {
    for (const row of incidents) {
      if (SAFE_TO_DROP.has(row.sync_state)) {
        await localDB.incidents.delete(row.id);
        dropped += 1;
      } else {
        await localDB.quarantine.put({
          key: qKey('incident', row.id),
          owner_user_id: userId,
          kind: 'incident',
          stored_at: new Date().toISOString(),
          payload: row,
        });
        await localDB.incidents.delete(row.id);
        quarantined += 1;
      }
    }
    for (const row of notes) {
      if (SAFE_TO_DROP.has(row.sync_state)) {
        await localDB.follow_up_notes.delete(row.id);
        dropped += 1;
      } else {
        await localDB.quarantine.put({
          key: qKey('note', row.id),
          owner_user_id: userId,
          kind: 'note',
          stored_at: new Date().toISOString(),
          payload: row,
        });
        await localDB.follow_up_notes.delete(row.id);
        quarantined += 1;
      }
    }
  });

  return { dropped, quarantined };
};

/** Restores a returning account's quarantined rows into the live tables. */
export const restoreQuarantine = async (userId: string): Promise<number> => {
  if (!userId) return 0;
  const rows = await localDB.quarantine.where('owner_user_id').equals(userId).toArray();
  if (rows.length === 0) return 0;

  await localDB.transaction('rw', localDB.incidents, localDB.follow_up_notes, localDB.quarantine, async () => {
    for (const row of rows) {
      if (row.kind === 'incident') {
        await localDB.incidents.put(row.payload as LocalIncident);
      } else {
        await localDB.follow_up_notes.put(row.payload as LocalFollowUpNote);
      }
      await localDB.quarantine.delete(row.key);
    }
  });

  return rows.length;
};

/**
 * Handles a change of active account. Called from the auth layer.
 * Safe to call with the same user twice — it does nothing when unchanged.
 */
export const applyAccountBoundary = async (
  previousUserId: string | null,
  nextUserId: string | null,
): Promise<{ dropped: number; quarantined: number; restored: number }> => {
  const prev = previousUserId || '';
  const next = nextUserId || '';
  if (prev === next) return { dropped: 0, quarantined: 0, restored: 0 };

  let dropped = 0;
  let quarantined = 0;
  if (prev) {
    const res = await quarantineUserData(prev);
    dropped = res.dropped;
    quarantined = res.quarantined;
  }
  const restored = next ? await restoreQuarantine(next) : 0;
  return { dropped, quarantined, restored };
};
