// Phase 2 — production Capture authority router.
//
// Legacy remains the default writer. Only an audited owner with the separate,
// internal canonical Capture flag uses the additive canonical local store.
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateIncident, useUpdateIncident } from '@/hooks/useIncidents';
import { useUploadEvidence } from '@/hooks/useEvidence';
import { toSafeAttachmentMessage, logAttachmentDiagnostic } from '@/lib/evidenceErrors';
import { canonicalLocalRepository } from '@/chronicle/model/canonicalLocalRepository';
import { isCanonicalCaptureEnabled } from '@/chronicle/model/canonicalCaptureFlag';

import {
  productionDraftKey,
  type CaptureAdapter,
  type CaptureMediaItem,
  type MediaFailure,
  type ReviewDetails,
} from './captureModel';
import { createCanonicalCaptureAdapter, createCaptureWriteRouter } from './canonicalCaptureAdapter';

const failureMessage = (e: unknown): string => {
  logAttachmentDiagnostic('capture media', e);
  return toSafeAttachmentMessage(e);
};

export const useProductionCaptureAdapter = (): CaptureAdapter => {
  const { user } = useAuth();
  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();
  const uploadEvidence = useUploadEvidence();
  const [canonicalActive, setCanonicalActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ownerId = user?.id ?? '';
    if (!ownerId) {
      setCanonicalActive(false);
      return () => { cancelled = true; };
    }
    void isCanonicalCaptureEnabled(ownerId).then(active => {
      if (!cancelled) setCanonicalActive(active);
    }).catch(() => {
      if (!cancelled) setCanonicalActive(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  return useMemo<CaptureAdapter>(() => {
    const legacy: CaptureAdapter = {
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
    };

    const ownerId = user?.id ?? '';
    const canonical = createCanonicalCaptureAdapter(ownerId, canonicalLocalRepository);
    const routed = createCaptureWriteRouter({
      legacy,
      canonical,
      canonicalEnabled: () => (
        ownerId ? isCanonicalCaptureEnabled(ownerId) : Promise.resolve(false)
      ),
      canonicalRecordExists: async (recordId) => {
        if (!ownerId) return false;
        const record = await canonicalLocalRepository.get(ownerId, recordId);
        return !!record && record.original.source !== 'imported_v1';
      },
    });

    // Input Helper is only visible when the audited canonical authority is
    // currently active. Legacy Capture cannot persist its provenance.
    return {
      ...routed,
      capabilities: canonicalActive ? canonical.capabilities : legacy.capabilities,
    };
  }, [user?.id, createIncident, updateIncident, uploadEvidence, canonicalActive]);
};
