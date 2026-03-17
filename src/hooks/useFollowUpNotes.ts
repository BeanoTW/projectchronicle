import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type FollowUpNote = Tables<'follow_up_notes'>;

export const useFollowUpNotes = (incidentId: string | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['follow_up_notes', incidentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follow_up_notes')
        .select('*')
        .eq('incident_id', incidentId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as FollowUpNote[];
    },
    enabled: !!user && !!incidentId,
  });
};

export const useCreateFollowUpNote = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (note: { incident_id: string; note_text: string; note_type: string }) => {
      const { error } = await supabase
        .from('follow_up_notes')
        .insert({ ...note, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['follow_up_notes', vars.incident_id] });
    },
  });
};
