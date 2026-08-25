import { useEffect, useRef, useState } from 'react';
import {
  type NotebookFilters,
  type DossierStatus,
  type RecordTypeFilter,
  cloneFilters,
  emptyFilters,
  activeFilterCount,
} from '../filters';
import { typeLabel, type AttachmentType } from '../media/mediaCore';

interface Props {
  open: boolean;
  value: NotebookFilters;
  categories: string[];
  people: string[];
  showEvidence?: boolean;
  showAttachmentTypes?: boolean;
  showRecordTypes?: boolean;
  onClose: () => void;
  onApply: (f: NotebookFilters) => void;
}

const FilterSheet = ({ open, value, categories, people, showEvidence = true, showAttachmentTypes = true, showRecordTypes = false, onClose, onApply }: Props) => {
  const [draft, setDraft] = useState<NotebookFilters>(cloneFilters(value));
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(cloneFilters(value));
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    return () => { cancelAnimationFrame(frame); restoreFocusRef.current?.focus(); };
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const toggle = (list: string[], item: string) => list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  const toggleButton = (on: boolean, handler: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className="proto-selchip" data-on={on} aria-pressed={on} onClick={handler}>{label}</button>
  );

  return (
    <div className="proto-sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="proto-sheet" role="dialog" aria-modal="true" aria-labelledby="chronicle-filter-title">
        <div className="proto-sheet-grip" aria-hidden="true" />
        <div className="proto-sheet-head">
          <h2 id="chronicle-filter-title" className="proto-h2" style={{ margin: 0 }}>Filters</h2>
          <button ref={closeRef} type="button" className="proto-btn" data-variant="ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={onClose}>Close</button>
        </div>
        <div className="proto-sheet-body">
          {showRecordTypes && <fieldset className="proto-fgroup"><legend className="proto-flabel">Record type</legend><div className="proto-chipwrap">
            {([['incident', 'Incident'], ['daily', 'Daily record']] as Array<[RecordTypeFilter, string]>).map(([v, label]) => toggleButton(draft.recordTypes.includes(v), () => setDraft({ ...draft, recordTypes: draft.recordTypes.includes(v) ? draft.recordTypes.filter(x => x !== v) : [...draft.recordTypes, v] }), label, v))}
          </div></fieldset>}
          <fieldset className="proto-fgroup"><legend className="proto-flabel">Category</legend>{categories.length === 0 ? <p className="proto-help">No categories on any record yet.</p> : <div className="proto-chipwrap">{categories.map(c => toggleButton(draft.categories.includes(c), () => setDraft({ ...draft, categories: toggle(draft.categories, c) }), c, c))}</div>}</fieldset>
          <fieldset className="proto-fgroup"><legend className="proto-flabel">People</legend>{people.length === 0 ? <p className="proto-help">No people recorded yet.</p> : <div className="proto-chipwrap">{people.map(p => toggleButton(draft.people.includes(p), () => setDraft({ ...draft, people: toggle(draft.people, p) }), p, p))}</div>}</fieldset>
          <fieldset className="proto-fgroup"><legend className="proto-flabel">Date range</legend><div className="proto-daterow">
            <label><span className="proto-help">From</span><input className="proto-input" type="date" value={draft.from ?? ''} onChange={e => setDraft({ ...draft, from: e.target.value || null })} /></label>
            <label><span className="proto-help">To</span><input className="proto-input" type="date" value={draft.to ?? ''} onChange={e => setDraft({ ...draft, to: e.target.value || null })} /></label>
          </div></fieldset>
          <fieldset className="proto-fgroup"><legend className="proto-flabel">Chronicle</legend><div className="proto-chipwrap">
            {([['any', 'Any'], ['included', 'In Chronicle'], ['excluded', 'Not in Chronicle']] as Array<[DossierStatus, string]>).map(([v, label]) => toggleButton(draft.dossier === v, () => setDraft({ ...draft, dossier: v }), label, v))}
          </div></fieldset>
          {showEvidence && <fieldset className="proto-fgroup"><legend className="proto-flabel">Evidence</legend><div className="proto-chipwrap">
            {toggleButton(draft.hasVoice, () => setDraft({ ...draft, hasVoice: !draft.hasVoice }), 'Has voice record')}
            {toggleButton(draft.hasAttachments, () => setDraft({ ...draft, hasAttachments: !draft.hasAttachments }), 'Has attachments')}
          </div>{showAttachmentTypes && <div className="proto-chipwrap" style={{ marginTop: 8 }}>{(['image', 'document', 'audio', 'video', 'other'] as AttachmentType[]).map(t => toggleButton(draft.attachmentTypes.includes(t), () => setDraft({ ...draft, attachmentTypes: toggle(draft.attachmentTypes, t) as AttachmentType[] }), typeLabel[t], t))}</div>}</fieldset>}
          <fieldset className="proto-fgroup"><legend className="proto-flabel">Clarifications</legend>{toggleButton(draft.withClarifications, () => setDraft({ ...draft, withClarifications: !draft.withClarifications }), 'Only records with clarifications')}</fieldset>
        </div>
        <div className="proto-sheet-foot">
          <button type="button" className="proto-btn" data-variant="ghost" onClick={() => setDraft(cloneFilters(emptyFilters))}>Clear all</button>
          <button type="button" className="proto-btn" data-variant="primary" onClick={() => onApply(draft)}>Apply{activeFilterCount(draft) > 0 ? ` (${activeFilterCount(draft)})` : ''}</button>
        </div>
      </div>
    </div>
  );
};

export default FilterSheet;
