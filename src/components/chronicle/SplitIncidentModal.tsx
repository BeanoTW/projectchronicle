import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scissors, ChevronLeft, ChevronRight, Trash2, Merge, Check } from 'lucide-react';

interface HighlightedTextProps {
  text: string;
  highlights: string[];
}

const HighlightedText = ({ text, highlights }: HighlightedTextProps) => {
  if (!highlights.length) return <p className="text-[14px] text-foreground leading-[1.7]">{text}</p>;

  // Build segments with highlights
  const sortedHighlights = highlights
    .map(h => ({ phrase: h, index: text.toLowerCase().indexOf(h.toLowerCase()) }))
    .filter(h => h.index !== -1)
    .sort((a, b) => a.index - b.index);

  if (!sortedHighlights.length) return <p className="text-[14px] text-foreground leading-[1.7]">{text}</p>;

  const segments: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;

  for (const h of sortedHighlights) {
    if (h.index < cursor) continue; // overlapping, skip
    if (h.index > cursor) {
      segments.push({ text: text.slice(cursor, h.index), highlighted: false });
    }
    segments.push({ text: text.slice(h.index, h.index + h.phrase.length), highlighted: true });
    cursor = h.index + h.phrase.length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return (
    <p className="text-[14px] text-foreground leading-[1.7]">
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <mark key={i} className="bg-primary/10 text-foreground rounded-sm px-0.5 py-0.5">
            {seg.text}
          </mark>
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

  const handleSplitChoice = (choice: 'keep' | 'split' | 'guide') => {
    if (choice === 'keep') {
      onKeepSingle();
      return;
    }
    // For split and guide, go to review
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
        {step === 'prompt' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Scissors className="h-4 w-4 text-primary" />
                </div>
                <DialogTitle className="text-[16px]">This may include multiple incidents</DialogTitle>
              </div>
              <DialogDescription className="text-[13px] leading-relaxed">
                We've highlighted parts of your entry that may represent separate events. 
                Separating them helps build a clearer timeline.
              </DialogDescription>
            </DialogHeader>

            {/* Highlighted narrative */}
            <div className="bg-muted/30 border border-border rounded-lg p-4 my-2 max-h-[200px] overflow-y-auto">
              <HighlightedText text={narrative} highlights={highlights} />
            </div>

            <p className="text-[12px] text-muted-foreground">
              {suggestedCount} potential event{suggestedCount !== 1 ? 's' : ''} detected
            </p>

            <div className="flex flex-col gap-2 mt-2">
              <Button
                onClick={() => handleSplitChoice('keep')}
                variant="outline"
                className="w-full justify-start h-11 rounded-xl text-[13px] font-medium"
              >
                Keep as 1 incident
              </Button>
              <Button
                onClick={() => handleSplitChoice('split')}
                className="w-full justify-start h-11 rounded-xl text-[13px] font-medium bg-primary text-primary-foreground"
              >
                Split into {suggestedCount} incidents
              </Button>
              <Button
                onClick={() => handleSplitChoice('guide')}
                variant="outline"
                className="w-full justify-start h-11 rounded-xl text-[13px] font-medium text-primary border-primary/20"
              >
                Not sure — guide me
              </Button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-[16px]">Review draft incidents</DialogTitle>
              <DialogDescription className="text-[13px]">
                Edit, remove, or merge these drafts before saving.
              </DialogDescription>
            </DialogHeader>

            {/* Draft navigation */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                {editableDrafts.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDraft(i)}
                    className={`w-7 h-7 rounded-md text-[12px] font-semibold transition-all ${
                      i === activeDraft 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={addDraft}
                  className="w-7 h-7 rounded-md text-[14px] bg-muted/30 text-muted-foreground hover:bg-muted transition-colors"
                >
                  +
                </button>
              </div>
              <span className="text-[12px] text-muted-foreground">
                {activeDraft + 1} of {editableDrafts.length}
              </span>
            </div>

            {/* Active draft editor */}
            {editableDrafts[activeDraft] && (
              <div className="space-y-3 bg-card border border-border rounded-xl p-4">
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
              </div>
            )}

            {/* Draft navigation arrows */}
            <div className="flex items-center justify-between mt-1">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveDraft(Math.max(0, activeDraft - 1))}
                  disabled={activeDraft === 0}
                  className="text-[12px] h-8"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveDraft(Math.min(editableDrafts.length - 1, activeDraft + 1))}
                  disabled={activeDraft === editableDrafts.length - 1}
                  className="text-[12px] h-8"
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
              {editableDrafts.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDraft(activeDraft)}
                  className="text-[12px] h-8 text-destructive/60 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
              <Button
                onClick={handleSave}
                className="w-full h-11 rounded-xl text-[13px] font-semibold bg-primary text-primary-foreground"
              >
                <Check className="h-4 w-4 mr-2" />
                Save {editableDrafts.filter(d => d.narrative.trim()).length} incident{editableDrafts.filter(d => d.narrative.trim()).length !== 1 ? 's' : ''}
              </Button>
              <Button
                variant="outline"
                onClick={mergeDrafts}
                className="w-full h-10 rounded-xl text-[13px] font-medium"
              >
                <Merge className="h-4 w-4 mr-2" />
                Revert — keep as single incident
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SplitIncidentModal;
