import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { computeSha256, deriveCaptureDate } from '@/lib/attachments/integrity';
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

/**
 * Check whether an attachment is referenced as the source for any transcript.
 * Used to surface a stronger confirmation before deletion.
 */
export const useIsTranscriptSource = () => {
  const { user } = useAuth();
  return async (evidenceId: string): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase
      .from('incidents')
      .select('id')
      .eq('user_id', user.id)
      .eq('transcription_source_attachment_id', evidenceId)
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  };
};

/**
 * Controlled, two-layer deletion:
 * 1) Removes the file from the 'evidence' storage bucket
 * 2) Deletes the evidence_files row (RLS scopes to owner)
 *
 * If the attachment is referenced as a transcript source, the linked
 * incident keeps its transcript text but the source attachment id is
 * cleared so rendering can show "Transcript source file removed".
 */
export const useDeleteEvidence = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ evidence }: { evidence: EvidenceFile }) => {
      if (!user) throw new Error('Not authenticated');

      // Clear transcript provenance pointers on any incidents that referenced this file.
      // Transcript text in raw_narrative is intentionally preserved.
      await supabase
        .from('incidents')
        .update({ transcription_source_attachment_id: null })
        .eq('user_id', user.id)
        .eq('transcription_source_attachment_id', evidence.id);

      // Remove the underlying storage object first to avoid orphans.
      const { error: storageError } = await supabase.storage
        .from('evidence')
        .remove([evidence.file_path]);
      // Storage 'not found' is acceptable (already gone) – do not abort row delete.
      if (storageError && !/not.?found/i.test(storageError.message)) {
        throw storageError;
      }

      const { error: dbError } = await supabase
        .from('evidence_files')
        .delete()
        .eq('id', evidence.id);
      if (dbError) throw dbError;

      return evidence.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
};
