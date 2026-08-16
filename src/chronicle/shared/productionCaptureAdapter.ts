// Phase 6C — production capture adapter.
//
// Writes go through the canonical production hooks only:
//   - useCreateIncident  → local-first record creation (idempotent on the record id)
//   - useUploadEvidence  → production evidence storage (same path as V1 capture)
//   - useUpdateIncident  → optional review details
//
// This file must never import the preview (`chronicle_prototype`) database, and
// must never write to Supabase directly from the UI.
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateIncident, useUpdateIncident } from '@/hooks/useIncidents';
import { useUploadEvidence } from '@/hooks/useEvidence';
import {
  productionDraftKey,
  type CaptureAdapter, type CaptureMediaItem, type MediaFailure, type ReviewDetails,
} from './captureModel';

// Internal database/storage detail must never reach the user; every failure is
// mapped to a calm, safe message (diagnostics stay in dev-only logging).
const failureMessage = (e: unknown): string => {
  logAttachmentDiagnostic('capture media', e);
  return toSafeAttachmentMessage(e);
};


export const useProductionCaptureAdapter = (): CaptureAdapter => {
  const { user } = useAuth();
  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();
  const uploadEvidence = useUploadEvidence();

  return useMemo<CaptureAdapter>(() => ({
    capabilities: {
      voice: true,
      attachments: true,
      storageCopy:
        'Your written record is saved on this device first. Voice records and attachments are stored ' +
        'in your private Chronicle storage, the same as the current record screen.',
      recordTypes: true,
      voicePrivacyNote:
        'Recording. When you seal, the audio is stored in your private Chronicle storage.',
    },
    draftKey: productionDraftKey(user?.id),

    async createRecord(input) {
      // The submission id is the record id, so a double-tap or a retry after a
      // slow network can only ever write the same row — never a duplicate.
      const row = await createIncident.mutateAsync({
        id: input.submissionId,
        raw_narrative: input.text,
        incident_date: input.sealedAt.slice(0, 10),
        record_method: input.hasVoice ? (input.text ? 'text_voice' : 'voice') : 'text',
        record_type: input.recordType === 'daily' ? 'daily_record' : 'incident',
        ...(input.recordType === 'daily' ? { record_date: input.sealedAt.slice(0, 10) } : {}),
        original_created_at: input.sealedAt,
        created_at: input.sealedAt,
      } as Parameters<typeof createIncident.mutateAsync>[0]);
      return { recordId: row.id, sealedAt: row.original_created_at ?? row.created_at };
    },

    async saveMedia(recordId: string, items: CaptureMediaItem[]) {
      const failures: MediaFailure[] = [];
      for (const item of items) {
        try {
          const file = new File([item.blob], item.name, { type: item.mime || 'application/octet-stream' });
          await uploadEvidence.mutateAsync({
            file,
            incidentId: recordId,
            description: item.kind === 'voice'
              ? `Voice record captured with this record${item.duration_ms ? ` (${Math.round(item.duration_ms / 1000)}s)` : ''}`
              : (item.description || undefined),
          });
        } catch (e) {
          failures.push({ item, message: failureMessage(e) });
        }
      }
      return failures;
    },

    async saveDetails(recordId: string, details: ReviewDetails) {
      await updateIncident.mutateAsync({
        id: recordId,
        category: details.category,
        category_source: details.category ? 'user' : 'ai',
        context_domain: details.context,
        people_involved: details.people,
        ...(details.eventDate ? { incident_date: details.eventDate } : {}),
        incident_time: details.eventTime,
      });
    },

    detailsPath: (id: string) => `/record/details/${id}`,
    recordPath: (id: string) => `/incident/${id}`,
    notebookPath: '/timeline',
  }), [user?.id, createIncident, updateIncident, uploadEvidence]);
};
