import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type RightsGuidance = Tables<'rights_guidance'>;

export const useRightsGuidance = () => {
  return useQuery({
    queryKey: ['rights_guidance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rights_guidance')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as RightsGuidance[];
    },
  });
};
