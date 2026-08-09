// Phase 6D — migrated production Dossier route (behind the `v2Dossier` flag).
//
// Real production data only:
//   - useIncidents         (local-first records)
//   - useAllFollowUpNotes  (clarifications)
//   - useEvidence          (attachments; Supabase-backed)
//   - useUpdateIncident    (inclusion persistence via excluded_from_rep)
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIncidents, useUpdateIncident } from '@/hooks/useIncidents';
import { useAllFollowUpNotes } from '@/hooks/useFollowUpNotes';
import { useEvidence } from '@/hooks/useEvidence';
import { supabase } from '@/integrations/supabase/client';
import DossierView from '@/v2/shared/DossierView';
import { usePrivacy } from '@/contexts/PrivacyContext';
import type { DossierAdapter, DossierEvidenceItem } from '@/v2/shared/dossierModel';
import {
  inclusionToExcluded,
  toDossierSourceMedia,
  toDossierSourceRecords,
} from '@/v2/shared/productionDossierAdapter';
import '@/v2/styles.css';
import { useOwnNavigationV2 } from '@/components/chronicle/NavigationOwnership';

const DossierScreenV2 = () => {
  // V2 owns navigation on this surface; the legacy V1 bottom nav is not mounted.
  useOwnNavigationV2();
  const navigate = useNavigate();
  const { enabled: shielded } = usePrivacy();
  const { data: incidents, isLoading } = useIncidents();
  const { data: notes } = useAllFollowUpNotes();
  const evidenceQuery = useEvidence();
  const updateIncident = useUpdateIncident();

  const evidence = useMemo(() => evidenceQuery.data ?? [], [evidenceQuery.data]);

  const records = useMemo(
    () => toDossierSourceRecords({ incidents: incidents ?? [], notes: notes ?? [] }),
    [incidents, notes],
  );
  const media = useMemo(
    () => toDossierSourceMedia(evidence, incidents ?? []),
    [evidence, incidents],
  );

  /* Storage paths for evidence blobs, resolved lazily during export. */
  const pathById = useMemo(() => {
    const map = new Map<string, string>();
    evidence.forEach(f => map.set(f.id, f.file_path));
    return map;
  }, [evidence]);

  const loadBlob = useCallback(async (mediaId: string): Promise<Blob | null> => {
    const path = pathById.get(mediaId);
    if (!path) return null;
    try {
      const { data, error } = await supabase.storage.from('evidence').download(path);
      if (error) return null;
      return data ?? null;
    } catch {
      // Unavailable file — the exporters fall back to a metadata-only reference.
      return null;
    }
  }, [pathById]);

  /* Signed URLs for on-screen image/audio previews, cached per session. */
  const urlCache = useRef(new Map<string, string>());
  const [, force] = useState(0);
  const useMediaUrl = useCallback((item: DossierEvidenceItem): string | null => {
    if (item.type !== 'image' && item.type !== 'audio') return null;
    const cached = urlCache.current.get(item.id);
    if (cached) return cached;
    const path = pathById.get(item.id);
    if (!path) return null;
    if (!urlCache.current.has(`pending:${item.id}`)) {
      urlCache.current.set(`pending:${item.id}`, '1');
      supabase.storage.from('evidence').createSignedUrl(path, 60 * 30).then(({ data }) => {
        if (data?.signedUrl) {
          urlCache.current.set(item.id, data.signedUrl);
          force(n => n + 1);
        }
      }).catch(() => { /* preview simply stays as a metadata reference */ });
    }
    return null;
  }, [pathById]);

  const setIncluded = useCallback(async (id: string, included: boolean) => {
    await updateIncident.mutateAsync({ id, excluded_from_rep: inclusionToExcluded(included) });
  }, [updateIncident]);

  const adapter: DossierAdapter = {
    records,
    media,
    loading: isLoading,
    setIncluded,
    loadBlob,
    useMediaUrl,
    evidenceNote:
      'Evidence always belongs to its record. If a record is not included, none of its attachments ' +
      'appear. Files that cannot be retrieved are listed as a reference instead of being embedded. ' +
      'No attachment-type selection means all types are included.',
  };

  return (
    <DossierView
      adapter={adapter}
      previewWithheld={
        shielded
          ? 'Privacy Shield is on, so the report is not shown on screen. Exported and printed copies are complete and unchanged — turn the shield off in Settings to preview here.'
          : null
      }
      onOpenRecord={id => navigate(`/incident/${id}`)}
      intro="The records you have chosen to bring together, in chronological order. Your report is generated from them — original wording is never altered."
    />
  );
};

export default DossierScreenV2;
