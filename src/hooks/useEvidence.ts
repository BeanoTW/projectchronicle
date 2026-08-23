import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { computeSha256, deriveCaptureDate } from '@/lib/attachments/integrity';
import { analytics } from '@/lib/analytics/analytics';
import {
  assertUploadAllowed,
  safeDisplayName,
  safeExtension,
  MAX_ATTACHMENTS_PER_RECORD,
} from '@/lib/uploadPolicy';
import { ensureIncidentOnServer } from '@/local/syncEngine';
import { EVIDENCE_MESSAGES, markUserSafe, logAttachmentDiagnostic } from '@/lib/evidenceErrors';
import { normaliseAttachmentDisplayName } from '@/lib/attachmentName';

import type { Tables } from '@/integrations/supabase/types';

export type EvidenceFile = Tables<'evidence_files'>;

export const useEvidence = (incidentId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['evidence', user?.id ?? 'anon', incidentId ?? 'all'],
    queryFn: async () => {
      // Ownership is enforced by RLS; the explicit filter is defence in depth
      // and keeps the query honest if a policy is ever relaxed.
      let query = supabase
        .from('evidence_files')
        .select('*')
        .eq('user_id', user!.id)
        .order('upload_date', { ascending: false });
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
      if (!user) throw markUserSafe(new Error(EVIDENCE_MESSAGES.signedOut), 'not_authenticated');

      // Single enforcement point. The capture picker validates too, but the
      // Attachments library and Evidence screen upload straight from a file
      // input, so the limit has to live here or it can be bypassed.
      let existingCount = 0;
      if (incidentId) {
        const { count } = await supabase
          .from('evidence_files')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('incident_id', incidentId);
        existingCount = count ?? 0;
      }
      try {
        assertUploadAllowed(file, existingCount);
      } catch (e) {
        throw markUserSafe(e as Error, 'rejected_by_policy');
      }

      // Compute SHA-256 BEFORE uploading so a failed hash blocks the insert
      // and we never end up with a stored file lacking integrity metadata.
      // It also acts as the idempotency key for retries.
      const fileHash = await computeSha256(file);
      const captureDate = deriveCaptureDate(file);

      // Idempotency: a retry (or a double tap) of the same file against the
      // same target must not create a second row or a second storage object.
      const dupQuery = supabase

        .from('evidence_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('file_hash', fileHash);
      const { data: existingRows } = await (incidentId
        ? dupQuery.eq('incident_id', incidentId)
        : dupQuery.is('incident_id', null));
      if (existingRows && existingRows.length > 0) {
        return existingRows[0] as EvidenceFile;
      }

      // The canonical incident row must exist server-side before an
      // evidence row can reference it (real foreign key, kept enforced).
      if (incidentId) {
        try {
          await ensureIncidentOnServer(user.id, incidentId);
        } catch (e) {
          logAttachmentDiagnostic('incident presence', e);
          throw e;
        }
      }

      const uniqueId = crypto.randomUUID();
      // Only a sanitised extension is taken from the user's filename, so the
      // name can never influence the storage path.
      const filePath = `${user.id}/${uniqueId}.${safeExtension(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file, { upsert: false });
      if (uploadError) {
        logAttachmentDiagnostic('storage upload', uploadError);
        throw markUserSafe(new Error(EVIDENCE_MESSAGES.generic), 'storage_failed');
      }

      const { data: inserted, error: dbError } = await supabase
        .from('evidence_files')
        .insert({
          user_id: user!.id,
          incident_id: incidentId || null,
          file_name: safeDisplayName(file.name),
          file_type: file.type.startsWith('image/') ? 'Photo' : file.type === 'application/pdf' ? 'Document' : 'Other',
          file_path: filePath,
          mime_type: file.type,
          file_size: file.size,
          file_hash: fileHash,
          capture_date: captureDate,
          description,
        })
        .select()
        .single();
      if (dbError) {
        logAttachmentDiagnostic('evidence insert', dbError);
        // Never leave an orphan storage object behind when the row fails.
        await supabase.storage.from('evidence').remove([filePath]).catch(() => {});
        throw markUserSafe(new Error(EVIDENCE_MESSAGES.generic), 'insert_failed');
      }
      analytics.track('attachment_added', {
        file_kind: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'other',
        linked_to_incident: !!incidentId,
      });
      return inserted as EvidenceFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
};

/** Updates only the user-managed label; the original evidence metadata stays immutable. */
export const useRenameEvidence = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ evidenceId, displayName }: { evidenceId: string; displayName: string }) => {
      if (!user) throw markUserSafe(new Error(EVIDENCE_MESSAGES.signedOut), 'not_authenticated');
      const display_name = normaliseAttachmentDisplayName(displayName);

      const { data, error } = await supabase
        .from('evidence_files')
        .update({ display_name })
        .eq('id', evidenceId)
        .eq('user_id', user.id)
        .select('id, display_name')
        .single();

      if (error) {
        logAttachmentDiagnostic('evidence rename', error);
        throw markUserSafe(new Error('This attachment could not be renamed. Please try again.'), 'rename_failed');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
};

/**
 * Links an existing (library) attachment to a specific incident.
 *
 * Guarantees the canonical incident row exists server-side first, so the
 * foreign key can never be violated. RLS scopes both sides to the owner, so
 * cross-account linking is impossible.
 */
export const useLinkEvidenceToIncident = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ evidenceId, incidentId }: { evidenceId: string; incidentId: string | null }) => {
      if (!user) throw markUserSafe(new Error(EVIDENCE_MESSAGES.signedOut), 'not_authenticated');

      if (incidentId) {
        const { count } = await supabase
          .from('evidence_files')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('incident_id', incidentId);
        if ((count ?? 0) >= MAX_ATTACHMENTS_PER_RECORD) {
          throw markUserSafe(
            new Error(`This record already has the maximum of ${MAX_ATTACHMENTS_PER_RECORD} attachments.`),
            'limit_reached',
          );
        }
        await ensureIncidentOnServer(user.id, incidentId);
      }

      const { error } = await supabase
        .from('evidence_files')
        .update({ incident_id: incidentId })
        .eq('id', evidenceId)
        .eq('user_id', user.id);
      if (error) {
        logAttachmentDiagnostic('evidence link', error);
        throw markUserSafe(new Error(EVIDENCE_MESSAGES.generic), 'link_failed');
      }
      return { evidenceId, incidentId };
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
