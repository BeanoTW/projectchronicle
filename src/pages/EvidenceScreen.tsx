import { useState, useRef, useEffect } from 'react';
import { Image, FileText, Music, Mail, Plus, Link2, ArrowRight, Eye, Trash2, Lock, Pencil, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEvidence, useUploadEvidence, useLinkEvidenceToIncident, useRenameEvidence, useDeleteEvidence, useIsTranscriptSource, type EvidenceFile } from '@/hooks/useEvidence';
import { toSafeAttachmentMessage } from '@/lib/evidenceErrors';
import { useIncidents } from '@/hooks/useIncidents';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EvidencePreview from '@/components/chronicle/EvidencePreview';
import { displayTitle } from '@/lib/displayTitle';
import { useAttachmentReveal } from '@/contexts/AttachmentRevealContext';
import { attachmentDisplayName, hasCustomAttachmentName } from '@/lib/attachmentName';
import DeleteAttachmentDialog from '@/components/chronicle/DeleteAttachmentDialog';
import ChroniclePageHeader from '@/chronicle/brand/ChroniclePageHeader';
import ChronicleEmptyState from '@/chronicle/brand/ChronicleEmptyState';
import AppSurface from '@/chronicle/shared/AppSurface';
import '@/chronicle/styles.css';

const filterTabs = [
  { label: 'All', value: 'all' },
  { label: 'Photos', value: 'Photo' },
  { label: 'Screenshots', value: 'Screenshot' },
  { label: 'Documents', value: 'Document' },
  { label: 'Audio', value: 'Audio' },
  { label: 'Emails', value: 'Email' },
];

const typeIcons: Record<string, typeof FileText> = {
  Photo: Image,
  Screenshot: Image,
  Document: FileText,
  Audio: Music,
  Email: Mail,
  Other: FileText,
};

const UploadButton = ({ onChange, inputRef }: { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; inputRef?: React.Ref<HTMLInputElement> }) => (
  <label className="proto-btn proto-evi-upload" data-variant="primary">
    <Plus aria-hidden="true" /> Upload
    <input type="file" className="proto-sr" ref={inputRef} onChange={onChange} />
  </label>
);

const EvidenceScreen = () => {
  const [previewFile, setPreviewFile] = useState<{ filePath: string; fileName: string; mimeType: string | null; fileHash: string | null; captureDate: string | null; uploadDate: string | null; incidentId: string | null } | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ evidence: EvidenceFile; isSource: boolean } | null>(null);
  const { data: allEvidence = [], isLoading, refetch } = useEvidence();
  const { data: incidents = [] } = useIncidents();
  const uploadEvidence = useUploadEvidence();
  const linkEvidence = useLinkEvidenceToIncident();
  const renameEvidence = useRenameEvidence();
  const deleteEvidence = useDeleteEvidence();
  const isTranscriptSource = useIsTranscriptSource();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { gateActive, requestReveal } = useAttachmentReveal();

  // Close any open preview if the reveal gate becomes active mid-session.
  useEffect(() => { if (gateActive) setPreviewFile(null); }, [gateActive]);

  const openPreview = async (ev: { file_path: string; file_name: string; display_name: string | null; mime_type: string | null; file_hash: string | null; capture_date: string | null; upload_date: string; incident_id: string | null }) => {
    if (gateActive) {
      const ok = await requestReveal();
      if (!ok) return;
    }
    setPreviewFile({ filePath: ev.file_path, fileName: attachmentDisplayName(ev), mimeType: ev.mime_type, fileHash: ev.file_hash, captureDate: ev.capture_date, uploadDate: ev.upload_date, incidentId: ev.incident_id });
  };

  const filtered = activeFilter === 'all' ? allEvidence : allEvidence.filter(e => e.file_type === activeFilter);
  const unlinkedCount = allEvidence.filter(e => !e.incident_id).length;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadEvidence.mutateAsync({ file });
      toast({ title: 'Attachment uploaded', description: 'Link it to a record to strengthen your documentation.' });
    } catch (err) {
      toast({ title: 'Attachment not saved', description: toSafeAttachmentMessage(err), variant: 'destructive' });
    }
  };

  const handleLinkEvidence = async (evidenceId: string, incidentId: string) => {
    try {
      await linkEvidence.mutateAsync({ evidenceId, incidentId });
      toast({ title: 'Attachment linked to record' });
      setLinkingId(null);
      setSelectedIncidentId('');
      refetch();
    } catch (err) {
      toast({ title: 'Could not link this attachment', description: toSafeAttachmentMessage(err), variant: 'destructive' });
    }
  };

  const handleRenameEvidence = async (evidenceId: string) => {
    try {
      await renameEvidence.mutateAsync({ evidenceId, displayName: renameValue });
      toast({ title: 'Attachment renamed' });
      setRenamingId(null);
      setRenameValue('');
    } catch (err) {
      toast({
        title: 'Could not rename this attachment',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const requestDeleteEvidence = async (evidence: EvidenceFile) => {
    try {
      const isSource = await isTranscriptSource(evidence.id);
      setPendingDelete({ evidence, isSource });
    } catch (err) {
      toast({
        title: 'Could not prepare this attachment for deletion',
        description: toSafeAttachmentMessage(err),
        variant: 'destructive',
      });
    }
  };

  const confirmDeleteEvidence = async () => {
    if (!pendingDelete) return;
    const { evidence } = pendingDelete;
    try {
      await deleteEvidence.mutateAsync({ evidence });
      setPendingDelete(null);
      toast({ title: 'Attachment deleted' });
    } catch (err) {
      toast({
        title: 'Could not delete this attachment',
        description: toSafeAttachmentMessage(err),
        variant: 'destructive',
      });
    }
  };

  const header = (
    <ChroniclePageHeader
      title="Attachments"
      eyebrow="Evidence"
      subtitle="Files linked to your records."
      actions={<UploadButton onChange={handleUpload} inputRef={fileInputRef} />}
    />
  );

  if (isLoading) {
    return (
      <AppSurface>
        {header}
        <div aria-busy="true">
          <span className="proto-sr">Loading...</span>
          {[0, 1].map(i => (
            <div className="proto-skeleton-card" key={i} aria-hidden="true">
              <div className="proto-skeleton-line" data-w="title" />
              <div className="proto-skeleton-line" data-w="meta" />
              <div className="proto-skeleton-line" data-w="short" />
            </div>
          ))}
        </div>
      </AppSurface>
    );
  }

  if (allEvidence.length === 0) {
    return (
      <AppSurface>
        {header}
        <ChronicleEmptyState>
          <strong style={{ display: 'block', color: 'var(--p-ink)', marginBottom: 4 }}>No attachments added yet</strong>
          You can upload screenshots, photos or documents. Each file can then be linked to a record to support your documentation.
        </ChronicleEmptyState>
      </AppSurface>
    );
  }

  return (
    <AppSurface>
      {header}

      {unlinkedCount > 0 && (
        <p className="proto-evi-notice" role="status">
          {unlinkedCount} attachment{unlinkedCount > 1 ? 's are' : ' is'} not linked to a record yet.
        </p>
      )}

      <div className="proto-evi-tabs" role="tablist" aria-label="Attachment type">
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeFilter === tab.value}
            data-active={activeFilter === tab.value}
            onClick={() => setActiveFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <ChronicleEmptyState>No attachments of this type.</ChronicleEmptyState>
      )}

      <ul className="proto-evi-list">
        {filtered.map((ev) => {
          const Icon = typeIcons[ev.file_type || 'Other'] || FileText;
          const displayName = attachmentDisplayName(ev);
          const hasCustomName = hasCustomAttachmentName(ev);
          const linkedIncident = incidents.find(inc => inc.id === ev.incident_id);
          const isLinking = linkingId === ev.id;
          const ref = `E${String(ev.evidence_ref_number || '?').padStart(2, '0')}`;

          return (
            <li key={ev.id} className="proto-evi-card" data-linked={!!linkedIncident}>
              <div className="proto-evi-top">
                <span className="proto-evi-icon" aria-hidden="true"><Icon /></span>
                <div className="proto-evi-main">
                  <div className="proto-evi-titlerow">
                    <span className="proto-evi-ref" title="Exhibit reference">{ref}</span>
                    <button type="button" className="proto-evi-name" onClick={() => openPreview(ev)}>{displayName}</button>
                  </div>
                  {hasCustomName && (
                    <p className="proto-evi-meta proto-evi-original" title={ev.file_name}>Original file: {ev.file_name}</p>
                  )}
                  <p className="proto-evi-meta">
                    {ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')} · Stored securely
                  </p>
                </div>
                <span className="proto-chip" data-tone={linkedIncident ? 'brass' : undefined}>
                  {linkedIncident ? 'Linked' : 'Not linked'}
                </span>
              </div>

              {ev.description && <p className="proto-evi-desc">{ev.description}</p>}

              {linkedIncident ? (
                <p className="proto-evi-linked">
                  <Link2 aria-hidden="true" /> {displayTitle(linkedIncident)}
                </p>
              ) : !isLinking ? (
                <button type="button" className="proto-btn proto-evi-linkbtn" onClick={() => setLinkingId(ev.id)}>
                  <Link2 aria-hidden="true" /> Link to a record <ArrowRight aria-hidden="true" className="proto-evi-arrow" />
                </button>
              ) : (
                <div className="proto-evi-linkrow">
                  <Select value={selectedIncidentId} onValueChange={setSelectedIncidentId}>
                    <SelectTrigger className="proto-evi-select" aria-label="Choose a record">
                      <SelectValue placeholder="Choose a record" />
                    </SelectTrigger>
                    <SelectContent>
                      {incidents.slice(0, 20).map(inc => (
                        <SelectItem key={inc.id} value={inc.id}>
                          {inc.title || format(parseISO(inc.incident_date), 'dd MMM yyyy')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="proto-btn"
                    data-variant="primary"
                    onClick={() => selectedIncidentId && handleLinkEvidence(ev.id, selectedIncidentId)}
                    disabled={!selectedIncidentId}
                  >
                    Link
                  </button>
                  <button type="button" className="proto-btn" data-variant="ghost" onClick={() => { setLinkingId(null); setSelectedIncidentId(''); }}>
                    Cancel
                  </button>
                </div>
              )}

              <div className="proto-evi-actions">
                <button type="button" onClick={() => openPreview(ev)}>
                  {gateActive ? <Lock aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  {gateActive ? 'Unlock to view' : 'View'}
                </button>
                <button type="button" onClick={() => { setRenamingId(ev.id); setRenameValue(displayName); }}>
                  <Pencil aria-hidden="true" /> Rename
                </button>
                <button type="button" data-tone="danger" onClick={() => { void requestDeleteEvidence(ev); }}>
                  <Trash2 aria-hidden="true" /> Remove
                </button>
              </div>

              {renamingId === ev.id && (
                <div className="proto-evi-rename">
                  <label htmlFor={`rename-${ev.id}`} className="proto-flabel">Attachment name</label>
                  <div className="proto-evi-renamerow">
                    <input
                      id={`rename-${ev.id}`}
                      className="proto-input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      maxLength={120}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && renameValue.trim()) handleRenameEvidence(ev.id);
                        if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                      }}
                    />
                    <button
                      type="button"
                      className="proto-btn"
                      data-variant="primary"
                      onClick={() => handleRenameEvidence(ev.id)}
                      disabled={!renameValue.trim() || renameEvidence.isPending}
                    >
                      <Check aria-hidden="true" /> {renameEvidence.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="proto-btn" data-variant="ghost" onClick={() => { setRenamingId(null); setRenameValue(''); }}>
                      <X aria-hidden="true" /> Cancel
                    </button>
                  </div>
                  <p className="proto-help" style={{ margin: '6px 0 0' }}>The original file and its integrity record will not change.</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <DeleteAttachmentDialog
        open={!!pendingDelete}
        fileName={pendingDelete?.evidence ? attachmentDisplayName(pendingDelete.evidence) : undefined}
        isTranscriptSource={!!pendingDelete?.isSource}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => { void confirmDeleteEvidence(); }}
        busy={deleteEvidence.isPending}
      />

      {previewFile && (
        <EvidencePreview
          filePath={previewFile.filePath}
          fileName={previewFile.fileName}
          mimeType={previewFile.mimeType}
          fileHash={previewFile.fileHash}
          captureDate={previewFile.captureDate}
          uploadDate={previewFile.uploadDate}
          incidentId={previewFile.incidentId}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </AppSurface>
  );
};

export default EvidenceScreen;