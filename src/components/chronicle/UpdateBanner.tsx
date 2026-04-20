import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_VERSION, RELEASE_NOTES } from '@/lib/appVersion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const DISMISS_KEY = 'chronicle-update-dismissed-version';

const UpdateBanner = () => {
  const [available, setAvailable] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [refresher, setRefresher] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const dismissedFor = localStorage.getItem(DISMISS_KEY);
    if (dismissedFor === APP_VERSION) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { reload?: () => Promise<void> } | undefined;
      setRefresher(() => detail?.reload ?? (async () => { window.location.reload(); }));
      setAvailable(true);
    };
    window.addEventListener('chronicle:update-available', handler);
    return () => window.removeEventListener('chronicle:update-available', handler);
  }, []);

  const handleRefresh = async () => {
    if (refresher) {
      try { await refresher(); } catch { window.location.reload(); }
    } else {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, APP_VERSION);
    setAvailable(false);
  };

  return (
    <>
      <AnimatePresence>
        {available && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 left-0 right-0 z-[60] px-3 pt-2"
            role="status"
            aria-live="polite"
          >
            <div className="max-w-lg mx-auto rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)] px-3.5 py-2.5 flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground leading-tight">
                  Update available
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  Refresh to use the latest version.
                </p>
              </div>
              <button
                onClick={() => setShowNotes(true)}
                className="text-[11px] text-muted-foreground/70 hover:text-foreground px-1.5 py-1 rounded transition-colors"
                aria-label="What changed"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
              <Button
                size="sm"
                onClick={handleRefresh}
                className="h-7 text-[11px] px-2.5 rounded-md font-semibold"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground/60 hover:text-foreground p-1 rounded transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showNotes} onOpenChange={setShowNotes}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>What changed</DialogTitle>
            <DialogDescription>Version {APP_VERSION}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 mt-2">
            {RELEASE_NOTES.map((note, i) => (
              <li key={i} className="text-[13px] text-foreground/90 leading-relaxed flex gap-2">
                <span className="text-muted-foreground/60 mt-1">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-3">
            Your records and local data are unaffected by updates.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UpdateBanner;
