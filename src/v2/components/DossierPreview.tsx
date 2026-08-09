// Preview-database wrapper around the shared dossier preview.
// Supplies object URLs for evidence blobs stored in `chronicle_prototype`.
import { useLiveQuery } from 'dexie-react-hooks';
import { v2DB, type V2Media } from '../db';
import type { DossierConfig, DossierDocumentModel, DossierEvidenceItem } from '../dossier/document';
import { useBlobUrl } from '../media/useBlobUrl';
import DossierPreviewView from '../shared/DossierPreviewView';

/** Hook-shaped resolver: one Dexie lookup per evidence item. */
export const usePreviewMediaUrl = (item: DossierEvidenceItem): string | null => {
  const row = useLiveQuery(() => v2DB.media.get(item.id), [item.id]) as V2Media | undefined;
  const previewable = item.type === 'image' || item.type === 'audio';
  return useBlobUrl(previewable ? row?.blob ?? null : null);
};

interface Props {
  doc: DossierDocumentModel;
  cfg: DossierConfig;
  onOpenRecord?: (id: string) => void;
}

const DossierPreview = ({ doc, cfg, onOpenRecord }: Props) => (
  <DossierPreviewView doc={doc} cfg={cfg} onOpenRecord={onOpenRecord} useMediaUrl={usePreviewMediaUrl} />
);

export default DossierPreview;
