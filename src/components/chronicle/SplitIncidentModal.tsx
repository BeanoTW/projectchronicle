import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scissors, ChevronLeft, ChevronRight, Trash2, Merge, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HighlightedTextProps {
  text: string;
  highlights: string[];
}

const highlightColors = [
  'bg-primary/15 border-b-2 border-primary/30',
  'bg-warm-accent/15 border-b-2 border-warm-accent/30',
  'bg-info/[0.12] border-b-2 border-info/25',
];

const HighlightedText = ({ text, highlights }: HighlightedTextProps) => {
  if (!highlights.length) return <p className="text-[14px] text-foreground leading-[1.7]">{text}</p>;

  const sortedHighlights = highlights
    .map((h, idx) => ({ phrase: h, index: text.toLowerCase().indexOf(h.toLowerCase()), colorIdx: idx }))
    .filter(h => h.index !== -1)
    .sort((a, b) => a.index - b.index);

  if (!sortedHighlights.length) return <p className="text-[14px] text-foreground leading-[1.7]">{text}</p>;

  const segments: { text: string; highlighted: boolean; colorIdx: number }[] = [];
  let cursor = 0;

  for (const h of sortedHighlights) {
    if (h.index < cursor) continue;
    if (h.index > cursor) {
      segments.push({ text: text.slice(cursor, h.index), highlighted: false, colorIdx: 0 });
    }
    segments.push({ text: text.slice(h.index, h.index + h.phrase.length), highlighted: true, colorIdx: h.colorIdx });
    cursor = h.index + h.phrase.length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false, colorIdx: 0 });
  }

  return (
    <p className="text-[14px] text-foreground leading-[1.7]">
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <motion.mark
            key={i}
            initial={{ backgroundColor: 'transparent' }}
            animate={{ backgroundColor: undefined }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            className={`${highlightColors[seg.colorIdx % highlightColors.length]} text-foreground rounded-sm px-0.5 py-0.5`}
          >
            {seg.text}
          </motion.mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
};

export interface IncidentDraft {
  title: string;
  narrative: string;
  incident_date: string | null;
  incident_time: string | null;
}

interface SplitIncidentModalProps {
  open: boolean;
  onClose: () => void;
  narrative: string;
  highlights: string[];
  suggestedCount: number;
  drafts: IncidentDraft[];
  onKeepSingle: () => void;
  onSaveSplit: (drafts: IncidentDraft[]) => void;
}

type ModalStep = 'prompt' | 'review';

const SplitIncidentModal = ({
  open,
  onClose,
  narrative,
  highlights,
  suggestedCount,
  drafts: initialDrafts,
  onKeepSingle,
  onSaveSplit,
}: SplitIncidentModalProps) => {
  const [step, setStep] = useState<ModalStep>('prompt');
  const [editableDrafts, setEditableDrafts] = useState<IncidentDraft[]>(initialDrafts);
  const [activeDraft, setActiveDraft] = useState(0);

  useEffect(() => {
    if (open) {
      setStep('prompt');
      setActiveDraft(0);
    }
  }, [open]);

  const handleSplitChoice = (choice: 'keep' | 'split' | 'guide') => {
    if (choice === 'keep') {
      onKeepSingle();
      return;
    }
    setEditableDrafts(initialDrafts.length > 0 ? initialDrafts : [
      { title: '', narrative: narrative, incident_date: null, incident_time: null },
      { title: '', narrative: '', incident_date: null, incident_time: null },
    ]);
    setActiveDraft(0);
    setStep('review');
  };

  const updateDraft = (index: number, field: keyof IncidentDraft, value: string | null) => {
    setEditableDrafts(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const removeDraft = (index: number) => {
    if (editableDrafts.length <= 1) return;
    const next = editableDrafts.filter((_, i) => i !== index);
    setEditableDrafts(next);
    setActiveDraft(Math.min(activeDraft, next.length - 1));
  };

  const addDraft = () => {
    setEditableDrafts(prev => [...prev, { title: '', narrative: '', incident_date: null, incident_time: null }]);
    setActiveDraft(editableDrafts.length);
  };

  const mergeDrafts = () => {
    onKeepSingle();
  };

  const handleSave = () => {
    const valid = editableDrafts.filter(d => d.narrative.trim());
    if (valid.length > 0) {
      onSaveSplit(valid);
    }
  };

  const validCount = editableDrafts.filter(d => d.narrative.trim()).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
        <AnimatePresence mode="wait">
          {step === 'prompt' && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Scissors className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <DialogTitle className="text-[16px]">This entry may contain more than one incident</DialogTitle>
                </div>
                <DialogDescription className="text-[13px] leading-relaxed">
                  We've highlighted parts of your entry that may represent separate events. Separating them can help build a clearer timeline.
                </DialogDescription>
              </DialogHeader>

              {/* Highlighted narrative */}
              <div className="bg-muted/30 border border-border rounded-xl p-4 my-3 max-h-[200px] overflow-y-auto">
                <HighlightedText text={narrative} highlights={highlights} />
              </div>

              <p className="text-[12px] text-muted-foreground font-medium">
                {suggestedCount} potential event{suggestedCount !== 1 ? 's' : ''} detected
              </p>

              <div className="flex flex-col gap-2.5 mt-3">
                <Button
                  onClick={() => handleSplitChoice('split')}
                  className="w-full justify-center h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  Split into {suggestedCount} incidents
                </Button>
                <Button
                  onClick={() => handleSplitChoice('keep')}
                  variant="ghost"
                  className="w-full justify-center h-10 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Keep as one incident
                </Button>
                <Button
                  onClick={() => handleSplitChoice('guide')}
                  variant="ghost"
                  className="w-full justify-center h-10 rounded-xl text-[13px] font-medium text-primary/70 hover:text-primary"
                >
                  Not sure — guide me
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <DialogHeader>
                <DialogTitle className="text-[16px]">Review draft incidents</DialogTitle>
                <DialogDescription className="text-[13px]">
                  Edit, remove, or merge these drafts before saving.
                </DialogDescription>
              </DialogHeader>

              {/* Draft tabs */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  {editableDrafts.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveDraft(i)}
                      className={`min-w-[36px] h-9 px-2 rounded-lg text-[13px] font-semibold transition-all ${
                        i === activeDraft
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={addDraft}
                    className="min-w-[36px] h-9 px-2 rounded-lg text-[15px] bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="text-[12px] text-muted-foreground font-medium">
                  Incident {activeDraft + 1} of {editableDrafts.length}
                </span>
              </div>

              {/* Active draft editor */}
              {editableDrafts[activeDraft] && (
                <motion.div
                  key={activeDraft}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 bg-card border border-border rounded-xl p-4"
                >
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Title</Label>
                    <Input
                      value={editableDrafts[activeDraft].title}
                      onChange={(e) => updateDraft(activeDraft, 'title', e.target.value)}
                      placeholder="Short title for this incident"
                      className="mt-1 rounded-lg text-[14px]"
                    />
                  </div>
                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground">Account</Label>
                    <Textarea
                      value={editableDrafts[activeDraft].narrative}
                      onChange={(e) => updateDraft(activeDraft, 'narrative', e.target.value)}
                      className="mt-1 min-h-[100px] rounded-lg text-[14px] leading-[1.7]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[12px] font-medium text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={editableDrafts[activeDraft].incident_date || ''}
                        onChange={(e) => updateDraft(activeDraft, 'incident_date', e.target.value || null)}
                        className="mt-1 rounded-lg text-[13px]"
                      />
                    </div>
                    <div>
                      <Label className="text-[12px] font-medium text-muted-foreground">Time</Label>
                      <Input
                        type="time"
                        value={editableDrafts[activeDraft].incident_time || ''}
                        onChange={(e) => updateDraft(activeDraft, 'incident_time', e.target.value || null)}
                        className="mt-1 rounded-lg text-[13px]"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Draft navigation arrows */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveDraft(Math.max(0, activeDraft - 1))}
                    disabled={activeDraft === 0}
                    className="text-[12px] h-9 text-muted-foreground"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveDraft(Math.min(editableDrafts.length - 1, activeDraft + 1))}
                    disabled={activeDraft === editableDrafts.length - 1}
                    className="text-[12px] h-9 text-primary font-medium"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
                {editableDrafts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDraft(activeDraft)}
                    className="text-[12px] h-9 text-destructive/60 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-border">
                <Button
                  onClick={handleSave}
                  className="w-full h-12 rounded-xl text-[14px] font-semibold bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save {validCount} incident{validCount !== 1 ? 's' : ''}
                </Button>
                <Button
                  variant="ghost"
                  onClick={mergeDrafts}
                  className="w-full h-10 rounded-xl text-[13px] font-medium text-muted-foreground"
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Revert — keep as single incident
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default SplitIncidentModal;
