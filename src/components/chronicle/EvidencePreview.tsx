import { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface EvidencePreviewProps {
  filePath: string;
  fileName: string;
  mimeType: string | null;
  onClose: () => void;
}

const EvidencePreview = ({ filePath, fileName, mimeType, onClose }: EvidencePreviewProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const getUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: urlError } = await supabase.storage
          .from('evidence')
          .createSignedUrl(filePath, 3600); // 1 hour
        if (urlError) throw urlError;
        setUrl(data.signedUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to open file');
      } finally {
        setLoading(false);
      }
    };
    getUrl();
  }, [filePath]);

  const isImage = mimeType?.startsWith('image/');
  const isAudio = mimeType?.startsWith('audio/');
  const isPdf = mimeType === 'application/pdf';

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 flex flex-col"
        onClick={onClose}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border bg-card"
          onClick={e => e.stopPropagation()}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground truncate">{fileName}</p>
          </div>
          <div className="flex items-center gap-2 ml-3">
            {isImage && url && (
              <>
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground active:scale-[0.95] transition-transform"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground active:scale-[0.95] transition-transform"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </>
            )}
            {url && (
              <button
                onClick={handleDownload}
                className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground active:scale-[0.95] transition-transform"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground active:scale-[0.95] transition-transform"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 flex items-center justify-center overflow-auto p-4"
          onClick={e => e.stopPropagation()}
        >
          {loading && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <p className="text-[13px] text-muted-foreground">Loading file…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <AlertTriangle className="h-8 w-8 text-destructive/70" />
              <p className="text-[14px] font-medium text-foreground">Unable to open file</p>
              <p className="text-[12px] text-muted-foreground">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  supabase.storage
                    .from('evidence')
                    .createSignedUrl(filePath, 3600)
                    .then(({ data, error: e }) => {
                      if (e) setError(e.message);
                      else setUrl(data.signedUrl);
                      setLoading(false);
                    });
                }}
                className="text-[13px] text-primary font-medium mt-1"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && url && (
            <>
              {isImage && (
                <img
                  src={url}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200"
                  style={{ transform: `scale(${zoom})` }}
                  draggable={false}
                />
              )}

              {isAudio && (
                <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4">
                  <p className="text-[14px] font-medium text-foreground">{fileName}</p>
                  <audio controls src={url} className="w-full" preload="metadata">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {isPdf && (
                <iframe
                  src={url}
                  className="w-full h-full rounded-lg border border-border"
                  title={fileName}
                />
              )}

              {!isImage && !isAudio && !isPdf && (
                <div className="flex flex-col items-center gap-3 text-center px-6">
                  <p className="text-[14px] font-medium text-foreground">Preview not available</p>
                  <p className="text-[12px] text-muted-foreground">This file type can't be previewed. You can download it instead.</p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-primary bg-primary/[0.06] border border-primary/12 rounded-lg active:scale-[0.97] transition-transform"
                  >
                    <Download className="h-3.5 w-3.5" /> Download file
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EvidencePreview;
