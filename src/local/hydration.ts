// One-time hydration: pull existing cloud records into the local store
// the first time a given user signs in on this device after the local-first migration.
// Subsequent loads read purely from the local store.
import { supabase } from '@/integrations/supabase/client';
import { localDB, getMeta, setMeta, META_KEYS, type LocalIncident, type LocalFollowUpNote } from './db';

export const hydrateFromCloudOnce = async (userId: string): Promise<{ hydrated: boolean; incidents: number; notes: number }> => {
  const key = META_KEYS.hydratedFor(userId);
  const already = await getMeta(key);
  if (already === '1') return { hydrated: false, incidents: 0, notes: 0 };

  // If offline, skip; we'll try again on next load.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { hydrated: false, incidents: 0, notes: 0 };
  }

  const nowIso = new Date().toISOString();

  // Race each network call against a timeout so a slow/offline backend
  // never wedges hydration. Local-first UI never waits on this anyway.
  const withTimeout = <T,>(p: PromiseLike<T>, ms = 5000): Promise<T | null> =>
    Promise.race<T | null>([
      Promise.resolve(p),
      new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
    ]);

  const incRes = await withTimeout(supabase.from('incidents').select('*'));
  if (!incRes || incRes.error) return { hydrated: false, incidents: 0, notes: 0 };
  const incidents = incRes.data;

  const notesRes = await withTimeout(supabase.from('follow_up_notes').select('*'));
  if (!notesRes || notesRes.error) return { hydrated: false, incidents: 0, notes: 0 };
  const notes = notesRes.data;

  const localIncidents: LocalIncident[] = (incidents ?? []).map(r => ({
    ...r,
    owner_user_id: userId,
    sync_state: 'backed_up',
    last_sync_attempt_at: nowIso,
    last_sync_error: null,
    local_updated_at: nowIso,
  }));
  const localNotes: LocalFollowUpNote[] = (notes ?? []).map(r => ({
    ...r,
    owner_user_id: userId,
    sync_state: 'backed_up',
    last_sync_attempt_at: nowIso,
    last_sync_error: null,
    local_updated_at: nowIso,
  }));

  // bulkPut keeps existing local edits if they share an id (Dexie overwrite),
  // but on first hydration the local store is empty for this user.
  await localDB.incidents.bulkPut(localIncidents);
  await localDB.follow_up_notes.bulkPut(localNotes);
  await setMeta(key, '1');

  return { hydrated: true, incidents: localIncidents.length, notes: localNotes.length };
};
