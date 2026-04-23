import { useState, useRef } from 'react';
import { X, Paperclip, Plus, Image, FileText, Music, Mail, Link2, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvidence, useUploadEvidence, useDeleteEvidence, useIsTranscriptSource, type EvidenceFile } from '@/hooks/useEvidence';
import { useIncidents } from '@/hooks/useIncidents';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EvidencePreview from './EvidencePreview';
import DeleteAttachmentDialog from './DeleteAttachmentDialog';
import { displayTitle } from '@/lib/displayTitle';

const typeIcons: Record<string, typeof FileText> = {
  Photo: Image, Screenshot: Image, Document: FileText, Audio: Music, Email: Mail, Other: FileText,
};

interface AttachmentsLibraryProps {
  open: boolean;
  onClose: () => void;
}

const AttachmentsLibrary = ({ open, onClose }: AttachmentsLibraryProps) => {
  const { data: allEvidence = [], refetch } = useEvidence();
  const { data: incidents = [] } = useIncidents();
  const uploadEvidence = useUploadEvidence();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<{ filePath: string; fileName: string; mimeType: string | null } | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Generate signed URLs for image thumbnails
  const getThumbnail = async (filePath: string, id: string) => {
    if (thumbnails[id]) return;
    const { data } = await supabase.storage.from('evidence').createSignedUrl(filePath, 3600);
    if (data?.signedUrl) setThumbnails(prev => ({ ...prev, [id]: data.signedUrl }));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadEvidence.mutateAsync({ file });
      toast({ title: 'Attachment uploaded', description: 'You can link it to a record now or later.' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  const handleLink = async (evidenceId: string, incidentId: string) => {
    try {
      const { error } = await supabase.from('evidence_files').update({ incident_id: incidentId }).eq('id', evidenceId);
      if (error) throw error;
      toast({ title: 'Linked to record' });
      setLinkingId(null);
      setSelectedIncidentId('');
      refetch();
    } catch {
      toast({ title: 'Failed to link', variant: 'destructive' });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" />
              <h2 className="text-[15px] font-semibold text-foreground">Attachments</h2>
              <span className="text-[11px] text-muted-foreground/60">{allEvidence.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-[12px] font-medium rounded-lg cursor-pointer active:scale-[0.97] transition-transform">
                <Plus className="h-3 w-3" /> Upload
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} accept="image/*,application/pdf,audio/*,.doc,.docx" />
              </label>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {allEvidence.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Paperclip className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-[13px] text-muted-foreground/60">No attachments yet</p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[13px] font-medium rounded-lg cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Upload first attachment
                  <input type="file" className="hidden" onChange={handleUpload} accept="image/*,application/pdf,audio/*" />
                </label>
              </div>
            ) : (
              allEvidence.map(ev => {
                const Icon = typeIcons[ev.file_type || 'Other'] || FileText;
                const isImage = ev.mime_type?.startsWith('image/');
                const linked = incidents.find(inc => inc.id === ev.incident_id);
                const isLinking = linkingId === ev.id;

                // Lazy load thumbnails for images
                if (isImage && !thumbnails[ev.id]) {
                  getThumbnail(ev.file_path, ev.id);
                }

                return (
                  <button
                    key={ev.id}
                    onClick={() => setPreviewFile({ filePath: ev.file_path, fileName: ev.file_name, mimeType: ev.mime_type })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:shadow-[var(--shadow-card-hover)] transition-all text-left active:scale-[0.98]"
                  >
                    {/* Thumbnail / Icon */}
                    <div className="w-11 h-11 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {isImage && thumbnails[ev.id] ? (
                        <img src={thumbnails[ev.id]} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Icon className="h-4.5 w-4.5 text-muted-foreground/60" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{ev.file_name}</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        {ev.file_type || 'File'} · {format(parseISO(ev.upload_date), 'dd MMM yyyy')}
                      </p>
                      {linked ? (
                        <p className="text-[11px] text-primary mt-0.5 truncate">→ {displayTitle(linked)}</p>
                      ) : (
                        <div onClick={e => e.stopPropagation()}>
                          {!isLinking ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setLinkingId(ev.id); }}
                              className="text-[11px] text-primary/70 font-medium mt-0.5 inline-flex items-center gap-1 hover:text-primary"
                            >
                              <Link2 className="h-2.5 w-2.5" /> Link to record
                            </button>
                          ) : (
                            <div className="flex gap-1.5 items-center mt-1" onClick={e => e.stopPropagation()}>
                              <Select value={selectedIncidentId} onValueChange={setSelectedIncidentId}>
                                <SelectTrigger className="bg-card text-[11px] h-7 flex-1 rounded-lg">
                                  <SelectValue placeholder="Select record" />
                                </SelectTrigger>
                                <SelectContent>
                                  {incidents.slice(0, 20).map(inc => (
                                    <SelectItem key={inc.id} value={inc.id}>
                                      {inc.title || format(parseISO(inc.incident_date), 'dd MMM yyyy')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button onClick={() => selectedIncidentId && handleLink(ev.id, selectedIncidentId)} disabled={!selectedIncidentId} className="text-[11px] text-primary font-medium disabled:opacity-40">Link</button>
                              <button onClick={() => { setLinkingId(null); setSelectedIncidentId(''); }} className="text-[11px] text-muted-foreground">✕</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {previewFile && (
            <EvidencePreview
              filePath={previewFile.filePath}
              fileName={previewFile.fileName}
              mimeType={previewFile.mimeType}
              onClose={() => setPreviewFile(null)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AttachmentsLibrary;
