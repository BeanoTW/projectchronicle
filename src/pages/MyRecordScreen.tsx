// Canonical Chronicle route.
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
import DossierView from '@/chronicle/shared/DossierView';
import AppSurface from '@/chronicle/shared/AppSurface';
import { usePrivacy } from '@/contexts/PrivacyContext';
import type { DossierAdapter, DossierEvidenceItem } from '@/chronicle/shared/dossierModel';
import {
  inclusionToExcluded,
  toDossierSourceMedia,
  toDossierSourceRecords,
} from '@/chronicle/shared/productionDossierAdapter';
import '@/chronicle/styles.css';

const MyRecordScreen = () => {
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
    <AppSurface>
      <DossierView
        adapter={adapter}
        previewWithheld={
          shielded
            ? 'Privacy Shield is on, so the report is not shown on screen. Exported and printed copies are complete and unchanged — turn the shield off in Settings to preview here.'
            : null
        }
        onOpenRecord={id => navigate(`/incident/${id}`)}
        intro="Your Notebook holds everything you have recorded. Your Chronicle holds the records you have chosen to bring together — a report is generated from them, and your original wording is never altered."
      />
    </AppSurface>
  );
};

export default MyRecordScreen;
