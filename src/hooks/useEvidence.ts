import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type EvidenceFile = Tables<'evidence_files'>;

export const useEvidence = (incidentId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['evidence', incidentId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('evidence_files').select('*').order('upload_date', { ascending: false });
      if (incidentId) query = query.eq('incident_id', incidentId);
      const { data, error } = await query;
      if (error) throw error;
      return data as EvidenceFile[];
    },
    enabled: !!user,
  });
};

export const useUploadEvidence = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, incidentId, description }: { file: File; incidentId?: string; description?: string }) => {
      const uniqueId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${user!.id}/${uniqueId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: inserted, error: dbError } = await supabase
        .from('evidence_files')
        .insert({
          user_id: user!.id,
          incident_id: incidentId || null,
          file_name: file.name,
          file_type: file.type.startsWith('image/') ? 'Photo' : file.type === 'application/pdf' ? 'Document' : 'Other',
          file_path: filePath,
          mime_type: file.type,
          file_size: file.size,
          description,
        })
        .select()
        .single();
      if (dbError) throw dbError;
      return inserted as EvidenceFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
};
