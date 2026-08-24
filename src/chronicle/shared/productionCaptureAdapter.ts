// Production capture adapter. The Phase 5 activation receipt is the cutover authority:
// pre-activation accounts keep the existing V1 path; activated accounts never create shadow V1 rows.
import { useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateIncident, useUpdateIncident } from '@/hooks/useIncidents';
import { useUploadEvidence } from '@/hooks/useEvidence';
import { toSafeAttachmentMessage, logAttachmentDiagnostic } from '@/lib/evidenceErrors';
import { getCanonicalActivation } from '@/chronicle/model/canonicalActivation';
import { canonicalCaptureRepository } from '@/chronicle/model/canonicalCaptureRepository';
import { canonicalLocalRepository } from '@/chronicle/model/canonicalLocalRepository';
import { canonicalEntryWriter } from '@/chronicle/model/canonicalEntryWriter';
import { canonicalPersonWriter } from '@/chronicle/model/canonicalPersonWriter';
import { canonicalRelationshipWriter } from '@/chronicle/model/canonicalRelationshipWriter';
import {
  productionDraftKey,
  type CaptureAdapter, type CaptureMediaItem, type MediaFailure, type ReviewDetails,
} from './captureModel';

const failureMessage = (e: unknown): string => {
  logAttachmentDiagnostic('capture media', e);
  return toSafeAttachmentMessage(e);
};

export const useProductionCaptureAdapter = (): CaptureAdapter => {
  const { user } = useAuth();
  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();
  const uploadEvidence = useUploadEvidence();
  // Only used for navigation immediately after a successful canonical seal.
  const canonicalIds = useRef(new Set<string>());

  return useMemo<CaptureAdapter>(() => ({
    capabilities: {
      voice: true,
      attachments: true,
      storageCopy: 'Your record is saved on this device first. Chronicle reports cloud backup separately and never treats an unconfirmed upload as complete.',
      recordTypes: true,
      voicePrivacyNote: 'Recording. When you seal, the audio is bound to the same immutable original record.',
    },
    draftKey: productionDraftKey(user?.id),

    async createRecord(input) {
      if (user?.id && await getCanonicalActivation(user.id)) {
        const row = await canonicalCaptureRepository.seal({
          id: input.submissionId,
          ownerId: user.id,
          kind: input.recordType === 'daily' ? 'daily' : 'incident',
          text: input.text,
          capturedAt: input.capturedAt,
          sealedAt: input.sealedAt,
          media: input.media,
        });
        canonicalIds.current.add(row.id);
        return { recordId: row.id, sealedAt: row.sealed_at, mediaStored: true, storageState: 'local_only' };
      }

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
      return { recordId: row.id, sealedAt: row.original_created_at ?? row.created_at, mediaStored: false };
    },

    async saveMedia(recordId: string, items: CaptureMediaItem[]) {
      // Canonical Capture never calls this: its media was committed atomically by createRecord.
      // Keeping the legacy uploader here preserves the pre-activation production path.
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
      if (user?.id && await getCanonicalActivation(user.id)) {
        const record = await canonicalLocalRepository.get(user.id, recordId);
        if (!record) throw new Error('Canonical record not found.');
        await canonicalEntryWriter.updateDetails(user.id, record, {
          category_id: details.category,
          context: details.context,
          event_date: details.eventDate ? { kind: 'exact', date: details.eventDate } : record.details.event_date,
          event_time: details.eventTime,
        });
        for (const name of details.people) {
          const person = await canonicalPersonWriter.ensure(user.id, name);
          await canonicalRelationshipWriter.add(user.id, recordId, 'person', person.id);
        }
        return;
      }
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

    detailsPath: (id: string) => canonicalIds.current.has(id) ? `/incident/${id}?editDetails=1` : `/record/details/${id}`,
    recordPath: (id: string) => `/incident/${id}`,
    notebookPath: '/timeline',
  }), [user?.id, createIncident, updateIncident, uploadEvidence]);
};
