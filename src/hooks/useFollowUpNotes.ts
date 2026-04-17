// Local-first follow-up notes hook.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { localDB, isBackupEnabled, type LocalFollowUpNote } from '@/local/db';
import { syncNow } from '@/local/syncEngine';
import type { Tables } from '@/integrations/supabase/types';

export type FollowUpNote = Tables<'follow_up_notes'>;

const nowIso = () => new Date().toISOString();

const triggerSync = async (userId: string) => {
  if (!(await isBackupEnabled())) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  syncNow(userId).catch(() => {});
};

export const useAllFollowUpNotes = () => {
  const { user } = useAuth();
  const data = useLiveQuery(
    async () => {
      if (!user) return [];
      const rows = await localDB.follow_up_notes
        .where('owner_user_id').equals(user.id)
        .toArray();
      return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    [user?.id],
    [] as LocalFollowUpNote[],
  );
  return { data, isLoading: data === undefined };
};

export const useFollowUpNotes = (incidentId: string | undefined) => {
  const { user } = useAuth();
  const data = useLiveQuery(
    async () => {
      if (!user || !incidentId) return [];
      const rows = await localDB.follow_up_notes
        .where({ owner_user_id: user.id, incident_id: incidentId })
        .toArray();
      return rows.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    },
    [user?.id, incidentId],
    [] as LocalFollowUpNote[],
  );
  return { data, isLoading: data === undefined };
};

export const useCreateFollowUpNote = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (note: { incident_id: string; note_text: string; note_type: string }) => {
      if (!user) throw new Error('Not signed in');
      const enabled = await isBackupEnabled();
      const ts = nowIso();
      const row: LocalFollowUpNote = {
        id: crypto.randomUUID(),
        user_id: user.id,
        created_at: ts,
        ...note,
        owner_user_id: user.id,
        sync_state: enabled ? 'queued' : 'local_only',
        last_sync_attempt_at: null,
        last_sync_error: null,
        local_updated_at: ts,
      };
      await localDB.follow_up_notes.put(row);
      await triggerSync(user.id);
      return row;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['follow_up_notes', vars.incident_id] });
    },
  });
};
