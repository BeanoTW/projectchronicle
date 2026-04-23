// Local-first incidents hook.
// Reads/writes go to Dexie. When backup is ON and online, writes also trigger
// an upload attempt — but the local write is the source of truth.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { localDB, isBackupEnabled, type LocalIncident } from '@/local/db';
import { syncNow } from '@/local/syncEngine';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Incident = Tables<'incidents'>;
export type IncidentInsert = TablesInsert<'incidents'>;

const nowIso = () => new Date().toISOString();

const triggerSync = async (userId: string) => {
  if (!(await isBackupEnabled())) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  // fire-and-forget; failures are tracked on the row's sync_state
  syncNow(userId).catch(() => {});
};

export const useIncidents = () => {
  const { user } = useAuth();
  const data = useLiveQuery(
    async () => {
      if (!user) return [];
      const rows = await localDB.incidents
        .where('owner_user_id').equals(user.id)
        .toArray();
      return rows.sort((a, b) => (a.incident_date < b.incident_date ? 1 : -1));
    },
    [user?.id],
    [] as LocalIncident[],
  );
  return { data, isLoading: data === undefined };
};

export const useIncident = (id: string | undefined) => {
  const { user } = useAuth();
  const data = useLiveQuery(
    async () => {
      if (!user || !id) return undefined;
      const row = await localDB.incidents.get(id);
      if (!row || row.owner_user_id !== user.id) return undefined;
      return row;
    },
    [user?.id, id],
  );
  return { data, isLoading: data === undefined };
};

export const useCreateIncident = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (incident: Omit<IncidentInsert, 'user_id'>) => {
      if (!user) throw new Error('Not signed in');
      const enabled = await isBackupEnabled();
      const id = (incident as { id?: string }).id ?? crypto.randomUUID();
      const ts = nowIso();
      const row: LocalIncident = {
        // defaults so the row matches the Incident shape
        ai_summary: null,
        category: null,
        category_source: 'ai',
        context_domain: null,
        exact_words: null,
        excluded_from_rep: false,
        impact_note: null,
        incident_time: null,
        location: null,
        people_involved: [],
        record_method: 'text',
        severity: null,
        status: 'Open',
        subtype: null,
        tags: [],
        title: null,
        void_reason: null,
        voided_at: null,
        witnesses: [],
        locked: false,
        original_created_at: ts,
        last_modified_at: ts,
        transcription_source_attachment_id: null,
        transcription_created_at: null,
        transcription_provider: null,
        transcription_model: null,
        version: 1,
        ...(incident as Partial<LocalIncident>),
        id,
        user_id: user.id,
        created_at: ts,
        updated_at: ts,
        // local-only metadata
        owner_user_id: user.id,
        sync_state: enabled ? 'queued' : 'local_only',
        last_sync_attempt_at: null,
        last_sync_error: null,
        local_updated_at: ts,
      } as LocalIncident;
      await localDB.incidents.put(row);
      await triggerSync(user.id);
      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
};

// Fields that count as a "main record edit" — touching any of these bumps
// last_modified_at locally. The DB trigger enforces the same set server-side.
const TRACKED_FIELDS: ReadonlyArray<keyof Incident> = [
  'raw_narrative',
  'category',
  'subtype',
  'location',
  'people_involved',
];

export const useUpdateIncident = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Incident>) => {
      if (!user) throw new Error('Not signed in');
      const existing = await localDB.incidents.get(id);
      if (!existing || existing.owner_user_id !== user.id) throw new Error('Record not found');
      const enabled = await isBackupEnabled();
      const ts = nowIso();
      const trackedChanged = TRACKED_FIELDS.some(
        (f) => f in updates && JSON.stringify((updates as Partial<Incident>)[f]) !== JSON.stringify(existing[f]),
      );
      const next: LocalIncident = {
        ...existing,
        ...updates,
        // original_created_at must never be overwritten from the client
        original_created_at: existing.original_created_at ?? existing.created_at,
        updated_at: ts,
        last_modified_at: trackedChanged ? ts : (existing.last_modified_at ?? existing.updated_at),
        local_updated_at: ts,
        sync_state: enabled ? 'queued' : (existing.sync_state === 'backed_up' ? 'queued' : 'local_only'),
      };
      await localDB.incidents.put(next);
      await triggerSync(user.id);
      return next;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', data.id] });
    },
  });
};

export const useDeleteIncident = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not signed in');
      const existing = await localDB.incidents.get(id);
      await localDB.incidents.delete(id);
      // If it was backed up, also remove from cloud (user-initiated, not silent — they pressed delete).
      if (existing?.sync_state === 'backed_up' && (await isBackupEnabled())) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.from('incidents').delete().eq('id', id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
};
