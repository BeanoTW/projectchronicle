import { useRef, useState } from 'react';
import { Paperclip, Plus, Loader2 } from 'lucide-react';
import { useUploadEvidence } from '@/hooks/useEvidence';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface AttachmentRowProps {
  count: number;
  onViewAttachments?: () => void;
  incidentId?: string;
}

const AttachmentRow = ({ count, onViewAttachments }: AttachmentRowProps) => {
  const uploadEvidence = useUploadEvidence();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadEvidence.mutateAsync({ file });
      toast({ title: 'Attachment added' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/60 bg-card/50">
      <button
        onClick={count > 0 ? onViewAttachments : () => fileInputRef.current?.click()}
        className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Paperclip className="h-3.5 w-3.5 text-primary/60" />
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.span key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </motion.span>
          ) : count > 0 ? (
            <motion.span key="count" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {count} attachment{count > 1 ? 's' : ''} added
            </motion.span>
          ) : (
            <motion.span key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground/60">
              Add attachment
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <label className="p-1.5 rounded-lg hover:bg-muted/40 cursor-pointer text-muted-foreground/50 hover:text-primary transition-colors active:scale-[0.95]">
        <Plus className="h-3.5 w-3.5" />
        <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} accept="image/*,application/pdf,audio/*,.doc,.docx" />
      </label>
    </div>
  );
};

export default AttachmentRow;
