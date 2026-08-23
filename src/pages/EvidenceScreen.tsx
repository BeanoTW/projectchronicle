import { useState, useRef, useEffect } from 'react';
import { Paperclip, Image, FileText, Music, Mail, Plus, Link2, ArrowRight, Eye, Trash2, Lock, Pencil, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useEvidence, useUploadEvidence, useLinkEvidenceToIncident, useRenameEvidence } from '@/hooks/useEvidence';
import { toSafeAttachmentMessage } from '@/lib/evidenceErrors';
import { useIncidents } from '@/hooks/useIncidents';
import EmptyState from '@/components/chronicle/EmptyState';
import PageHeader from '@/components/chronicle/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import EvidencePreview from '@/components/chronicle/EvidencePreview';
import { displayTitle } from '@/lib/displayTitle';
import { useAttachmentReveal } from '@/contexts/AttachmentRevealContext';
import { attachmentDisplayName, hasCustomAttachmentName } from '@/lib/attachmentName';

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

const typeAccentClass: Record<string, string> = {
  Photo: 'evidence-accent-photo',
  Screenshot: 'evidence-accent-photo',
  Document: 'evidence-accent-document',
  Audio: 'evidence-accent-audio',
  Email: 'evidence-accent-email',
};

const typeTintBg: Record<string, string> = {
  Photo: 'bg-primary/[0.06]',
  Screenshot: 'bg-primary/[0.06]',
  Document: 'bg-info-light',
  Audio: 'bg-warm-accent-light',
  Email: 'bg-rep',
};

const EvidenceScreen = () => {
  const [previewFile, setPreviewFile] = useState<{ filePath: string; fileName: string; mimeType: string | null; fileHash: string | null; captureDate: string | null; uploadDate: string | null; incidentId: string | null } | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { data: allEvidence = [], isLoading, refetch } = useEvidence();
  const { data: incidents = [] } = useIncidents();
  const uploadEvidence = useUploadEvidence();
  const linkEvidence = useLinkEvidenceToIncident();
  const renameEvidence = useRenameEvidence();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { gateActive, requestReveal } = useAttachmentReveal();

  // Close any open preview if the reveal gate becomes active mid-session.
  useEffect(() => { if (gateActive) setPreviewFile(null); }, [gateActive]);

  const openPreview = async (ev: { file_path: string; file_name: string; mime_type: string | null; file_hash: string | null; capture_date: string | null; upload_date: string; incident_id: string | null }) => {
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

  const handleRemoveEvidence = async (evidenceId: string, filePath: string) => {
    try {
      await supabase.storage.from('evidence').remove([filePath]);
      const { error } = await supabase.from('evidence_files').delete().eq('id', evidenceId);
      if (error) throw error;
      toast({ title: 'Attachment removed' });
      refetch();
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background pb-24 flex items-center justify-center"><p className="text-muted-foreground text-[14px]">Loading...</p></div>;
  }

  if (allEvidence.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Attachments" subtitle="Files linked to your records">
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-[12px] font-medium rounded-lg cursor-pointer shadow-[var(--shadow-elevated)] active:scale-[0.97] transition-transform">
            <Plus className="h-3.5 w-3.5" /> Upload
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
        </PageHeader>
        <EmptyState
          icon={<Paperclip className="h-10 w-10" />}
          heading="No attachments added yet"
          body="You can upload screenshots, photos, or documents — these files can be linked to records to support your documentation."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      <PageHeader title="Attachments" subtitle="Files linked to your records">
        <label className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-[12px] font-semibold rounded-lg cursor-pointer shadow-[var(--shadow-elevated)] active:scale-[0.97] transition-all duration-150 hover:shadow-[var(--shadow-card-hover)]">
          <Plus className="h-3.5 w-3.5" /> Upload
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} />
        </label>
      </PageHeader>

      {unlinkedCount > 0 && (
        <div className="mx-5 mb-4 px-4 py-2.5 rounded-lg bg-warm-accent-light border border-warm-accent/15 text-warm-accent-foreground text-[12px] font-medium">
          {unlinkedCount} item{unlinkedCount > 1 ? 's' : ''} awaiting connection
        </div>
      )}

      <div className="px-5 pb-3 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-3 py-1.5 rounded text-[12px] font-medium transition-all duration-150 ${
                activeFilter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 space-y-2.5">
        {filtered.map((ev) => {
          const Icon = typeIcons[ev.file_type || 'Other'] || FileText;
          const displayName = attachmentDisplayName(ev);
          const hasCustomName = hasCustomAttachmentName(ev);
          const linkedIncident = incidents.find(inc => inc.id === ev.incident_id);
          const isLinking = linkingId === ev.id;
          const accentClass = typeAccentClass[ev.file_type || ''] || 'evidence-accent-default';
          const tintBg = typeTintBg[ev.file_type || ''] || '';
          const iconTint = ev.file_type === 'Photo' || ev.file_type === 'Screenshot'
            ? 'text-primary/70' : ev.file_type === 'Audio'
            ? 'text-warm-accent' : ev.file_type === 'Email'
            ? 'text-rep-foreground' : 'text-muted-foreground';

          return (
            <div
              key={ev.id}
              className={`rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] cursor-pointer ${accentClass}`}
              onClick={() => openPreview(ev)}
            >
              <div className="flex gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tintBg || 'bg-muted/50'}`}>
                  <Icon className={`h-4 w-4 ${iconTint}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/8 text-primary border border-primary/12">
                        E{String(ev.evidence_ref_number || '?').padStart(2, '0')}
                      </span>
                      <p className="text-[13px] font-medium text-foreground truncate">{displayName}</p>
                    </div>
                    {linkedIncident ? (
                      <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary border-primary/20 hover:bg-primary/15 flex-shrink-0">
                        Linked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-warm-accent-foreground border-warm-accent/25 bg-warm-accent-light flex-shrink-0">
                        Unlinked
                      </Badge>
                    )}
                  </div>
                  {hasCustomName && (
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate" title={ev.file_name}>Original: {ev.file_name}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')} · Stored securely
                  </p>
                  {linkedIncident ? (
                    <p className="text-[12px] text-primary mt-1.5 truncate">
                      → {displayTitle(linkedIncident)}
                    </p>
                  ) : (
                    <div className="mt-2" onClick={e => e.stopPropagation()}>
                      {!isLinking ? (
                        <button
                          onClick={() => setLinkingId(ev.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-primary bg-primary/[0.06] border border-primary/12 hover:bg-primary/10 active:scale-[0.97] transition-all duration-150"
                        >
                          <Link2 className="h-3 w-3" />
                          Link to incident
                          <ArrowRight className="h-3 w-3 opacity-50" />
                        </button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <Select value={selectedIncidentId} onValueChange={setSelectedIncidentId}>
                            <SelectTrigger className="bg-card text-[12px] h-8 flex-1 rounded-lg">
                              <SelectValue placeholder="Select incident" />
                            </SelectTrigger>
                            <SelectContent>
                              {incidents.slice(0, 20).map(inc => (
                                <SelectItem key={inc.id} value={inc.id}>
                                  {inc.title || format(parseISO(inc.incident_date), 'dd MMM yyyy')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button onClick={() => selectedIncidentId && handleLinkEvidence(ev.id, selectedIncidentId)} disabled={!selectedIncidentId} className="text-[12px] text-primary font-medium disabled:opacity-40">Link</button>
                          <button onClick={() => { setLinkingId(null); setSelectedIncidentId(''); }} className="text-[12px] text-muted-foreground">Cancel</button>
                        </div>
                      )}
                    </div>
                  )}
                  {ev.description && <p className="text-[12px] text-body mt-1.5 leading-relaxed">{ev.description}</p>}
                  
                  {/* Actions row */}
                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openPreview(ev)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 active:scale-[0.97] transition-all"
                    >
                      {gateActive ? <Lock className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {gateActive ? 'Unlock to view' : 'View'}
                    </button>
                    <button
                      onClick={() => { setRenamingId(ev.id); setRenameValue(displayName); }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary active:scale-[0.97] transition-all"
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                    <button
                      onClick={() => handleRemoveEvidence(ev.id, ev.file_path)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive active:scale-[0.97] transition-all"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                  {renamingId === ev.id && (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-3" onClick={e => e.stopPropagation()}>
                      <label htmlFor={`rename-${ev.id}`} className="block text-[11px] font-semibold text-foreground mb-1.5">Attachment name</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          id={`rename-${ev.id}`}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          maxLength={120}
                          autoFocus
                          className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && renameValue.trim()) handleRenameEvidence(ev.id);
                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRenameEvidence(ev.id)}
                            disabled={!renameValue.trim() || renameEvidence.isPending}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> {renameEvidence.isPending ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setRenamingId(null); setRenameValue(''); }}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border px-3 text-[12px] font-medium text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">The original file and its integrity record will not change.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
};

export default EvidenceScreen;
