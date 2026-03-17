import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type EditHistoryEntry = Tables<'edit_history'>;

export const useEditHistory = (incidentId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['edit_history', incidentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('edit_history')
        .select('*')
        .eq('incident_id', incidentId!)
        .order('changed_at', { ascending: true });
      if (error) throw error;
      return data as EditHistoryEntry[];
    },
    enabled: !!user && !!incidentId,
  });
};

export const useCreateEditHistory = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (entry: { incident_id: string; field_changed: string; old_value?: string; new_value?: string }) => {
      const { error } = await supabase
        .from('edit_history')
        .insert({ ...entry, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['edit_history', vars.incident_id] });
    },
  });
};
