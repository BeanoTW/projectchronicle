import { V2_BASE } from '../routes';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { v2DB, type V2Entry, type V2Media } from '../db';
import { STORAGE_COPY } from '../media/mediaCore';
import { toSourceMedia, toSourceRecord } from '../dossier/document';
import { previewLoadBlob } from '../dossier/evidenceImages';
import DossierView from '../shared/DossierView';
import type { DossierAdapter } from '../shared/dossierModel';
import { usePreviewMediaUrl } from '../components/DossierPreview';

/** V2 preview Dossier — same shared view as production, backed by `chronicle_prototype`. */
const DossierScreen = () => {
  const navigate = useNavigate();

  const all = useLiveQuery(async () => v2DB.entries.toArray(), [], []) as V2Entry[];
  const media = useLiveQuery(async () => v2DB.media.toArray(), [], []) as V2Media[];

  const setIncluded = useCallback(async (id: string, included: boolean) => {
    await v2DB.entries.update(id, { in_dossier: included });
  }, []);

  const adapter: DossierAdapter = {
    records: all.map(toSourceRecord),
    media: media.map(toSourceMedia),
    loading: false,
    setIncluded,
    loadBlob: previewLoadBlob,
    useMediaUrl: usePreviewMediaUrl,
    evidenceNote:
      'Evidence always belongs to its record. If a record is not included, none of its evidence ' +
      'appears. Individual files can be excluded from within a record’s Evidence section. ' +
      'No attachment-type selection means all types are included. ' + STORAGE_COPY,
  };

  return (
    <DossierView
      adapter={adapter}
      onOpenRecord={id => navigate(`${V2_BASE}/entry/${id}`)}
    />
  );
};

export default DossierScreen;
