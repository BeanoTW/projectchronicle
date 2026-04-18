import { useState } from 'react';
import { Plus, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { INTERACTION_TYPES, type Interaction } from '@/types/dailyRecord';

interface Props {
  interactions: Interaction[];
  onChange: (next: Interaction[]) => void;
  /** Read-only renderer (used in Review). */
  readOnly?: boolean;
}

/**
 * Optional structured-interactions editor for daily records.
 * - Always optional, never auto-filled.
 * - `type` is the only required field per row.
 * - No interpretation, no inferred fields.
 */
const InteractionsEditor = ({ interactions, onChange, readOnly = false }: Props) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Interaction>({ type: 'Spoke with' });

  const commit = () => {
    if (!draft.type) return;
    onChange([
      ...interactions,
      {
        type: draft.type,
        ...(draft.time ? { time: draft.time } : {}),
        ...(draft.who ? { who: draft.who } : {}),
        ...(draft.context ? { context: draft.context } : {}),
      },
    ]);
    setDraft({ type: 'Spoke with' });
    setAdding(false);
  };

  const remove = (idx: number) => {
    onChange(interactions.filter((_, i) => i !== idx));
  };

  if (readOnly) {
    if (interactions.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {interactions.map((it, i) => (
          <div key={i} className="text-[13px] text-foreground leading-relaxed">
            <span className="text-muted-foreground/70">
              {it.time ? `${it.time} — ` : ''}
            </span>
            <span className="font-medium">{it.type}</span>
            {it.who ? <span> — {it.who}</span> : null}
            {it.context ? <span className="text-muted-foreground"> — {it.context}</span> : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {interactions.length > 0 && (
        <ul className="space-y-1.5">
          {interactions.map((it, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/60"
            >
              <div className="flex-1 min-w-0 text-[13px] leading-relaxed">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {it.time && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {it.time}
                    </span>
                  )}
                  <span className="font-medium text-foreground">{it.type}</span>
                  {it.who && <span className="text-foreground">— {it.who}</span>}
                </div>
                {it.context && (
                  <p className="text-[12px] text-muted-foreground mt-0.5">{it.context}</p>
                )}
              </div>
              <button
                onClick={() => remove(i)}
                className="p-1 -m-1 text-muted-foreground/60 hover:text-destructive transition-colors"
                aria-label="Remove interaction"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 p-3 rounded-lg border border-border bg-card">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Time</Label>
                  <Input
                    type="time"
                    value={draft.time ?? ''}
                    onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
                    className="h-9 mt-1 rounded-lg text-[13px]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Type *</Label>
                  <Select
                    value={String(draft.type)}
                    onValueChange={v => setDraft(d => ({ ...d, type: v }))}
                  >
                    <SelectTrigger className="h-9 mt-1 rounded-lg text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERACTION_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Who</Label>
                <Input
                  value={draft.who ?? ''}
                  onChange={e => setDraft(d => ({ ...d, who: e.target.value }))}
                  placeholder="Optional"
                  className="h-9 mt-1 rounded-lg text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Context</Label>
                <Input
                  value={draft.context ?? ''}
                  onChange={e => setDraft(d => ({ ...d, context: e.target.value }))}
                  placeholder="Optional"
                  className="h-9 mt-1 rounded-lg text-[13px]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={commit}
                  disabled={!draft.type}
                  className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAdding(false); setDraft({ type: 'Spoke with' }); }}
                  className="px-3 h-9 rounded-lg text-[12px] text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add interaction
        </button>
      )}
    </div>
  );
};

export default InteractionsEditor;
