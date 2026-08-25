// Shared source-agnostic record view.
import { useState, type ReactNode } from 'react';
import type { ClarificationKind } from '../model/schema';
import '../styles.css';

export interface SharedClarification { id: string; text: string; created_at: string; kind?: ClarificationKind; }
export interface SharedEntryView {
  id: string; title: string | null; original_text: string; sealed_at: string;
  /** Canonical integrity metadata. Omitted by legacy adapters that do not expose provenance. */
  provenance_label?: string;
  clarifications: SharedClarification[]; in_dossier: boolean; details: Array<[string, string]>;
}
export interface EntryViewProps {
  entry: SharedEntryView;
  onBack: () => void;
  onAddClarification: (text: string, kind: ClarificationKind) => Promise<void>;
  onToggleDossier: () => void | Promise<void>;
  onEditDetails?: () => void;
  evidenceSlot?: ReactNode;
  backLabel?: string;
  notice?: ReactNode;
  footerSlot?: ReactNode;
  standalone?: boolean;
  /** False during a read cutover where the corresponding write authority has not moved yet. */
  allowMutations?: boolean;
  /** Reveals optional plain-language clarification types only for canonical records. */
  allowClarificationKinds?: boolean;
}

const kindLabel: Record<ClarificationKind, string> = { clarification: 'Clarification', follow_up: 'Follow-up', outcome: 'Outcome', correction: 'Correction' };

const EntryView = ({ entry, onBack, onAddClarification, onToggleDossier, onEditDetails, evidenceSlot, notice, footerSlot, backLabel = '← Notebook', standalone = true, allowMutations = true, allowClarificationKinds = false }: EntryViewProps) => {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<ClarificationKind>('clarification');
  const clarifications = [...entry.clarifications].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const save = async () => {
    const body = text.trim(); if (!body || !allowMutations) return;
    setSaving(true); try { await onAddClarification(body, kind); setText(''); setKind('clarification'); setAdding(false); } finally { setSaving(false); }
  };

  const body = <><div>
    <button className="proto-btn" data-variant="ghost" onClick={onBack} style={{ padding: '4px 8px', marginBottom: 8, minHeight: 32 }}>{backLabel}</button>
    <h1 className="proto-h1">{entry.title || 'Original record'}</h1>
    <div className="proto-entry-meta" style={{ marginBottom: entry.provenance_label ? 4 : 12 }}>
      <span>Sealed {new Date(entry.sealed_at).toLocaleString()}</span><span className="proto-chip">Sealed</span>
      {clarifications.length > 0 && <span className="proto-chip">{clarifications.length} clarification{clarifications.length === 1 ? '' : 's'}</span>}
      {entry.in_dossier && <span className="proto-chip" data-tone="brass">In Chronicle</span>}
    </div>
    {entry.provenance_label && <p className="proto-help" style={{ marginTop: 0, marginBottom: 12 }}>{entry.provenance_label}</p>}
    {notice && <p className="proto-help" role="status" style={{ marginBottom: 10 }}>{notice}</p>}
    <div className="proto-entrylayout"><div>
      <div className="proto-sealed-note"><div className="proto-sealed-label">Written record — unchanged</div>
        {entry.original_text ? <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.55 }}>{entry.original_text}</div> : <p className="proto-help" style={{ margin: 0 }}>No written wording. This record was captured as a voice record.</p>}
      </div>
      <section style={{ marginTop: 20 }}><h2 className="proto-h2">Clarifications</h2><p className="proto-help" style={{ marginBottom: 10 }}>A clarification adds context without changing your original record.</p>
        {clarifications.length === 0 && !adding && <div className="proto-empty">No clarifications added.</div>}
        {clarifications.map((c, i) => <div key={c.id} className="proto-clar"><div className="proto-entry-meta"><span>{kindLabel[c.kind ?? 'clarification']} {i + 1}</span><span>{new Date(c.created_at).toLocaleString()}</span></div><div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</div></div>)}
        {allowMutations && (adding ? <div style={{ marginTop: 10 }}>{allowClarificationKinds && <label className="proto-field"><span>What are you adding?</span><select className="proto-input" value={kind} onChange={e => setKind(e.target.value as ClarificationKind)}><option value="clarification">More context</option><option value="follow_up">What happened next</option><option value="outcome">An outcome</option><option value="correction">A correction</option></select></label>}<textarea className="proto-textarea" autoFocus placeholder="Add context, a correction of understanding, or what happened next." value={text} onChange={e => setText(e.target.value)} /><div className="proto-actions-row" style={{ marginTop: 8 }}><button className="proto-btn" data-variant="ghost" onClick={() => { setAdding(false); setText(''); setKind('clarification'); }}>Cancel</button><button className="proto-btn" data-variant="primary" disabled={!text.trim() || saving} onClick={save}>Save clarification</button></div></div> : <button className="proto-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => setAdding(true)}>Add clarification</button>)}
      </section>
    </div><div>{evidenceSlot}
      <section style={{ marginTop: 20 }}><h2 className="proto-h2">Organisational details</h2><div className="proto-entry">{entry.details.length === 0 ? <p className="proto-help" style={{ margin: 0 }}>No details added.</p> : <dl className="proto-deflist">{entry.details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}{allowMutations && onEditDetails && <button className="proto-btn" style={{ marginTop: 10, width: '100%' }} onClick={onEditDetails}>Edit details</button>}</div><p className="proto-help" style={{ marginTop: 6 }}>Details are organisational only. Editing them never alters the sealed wording above.</p></section>
      {footerSlot}
      {allowMutations && <div style={{ marginTop: 20 }}><button className="proto-btn" data-variant={entry.in_dossier ? 'ghost' : 'primary'} onClick={() => { void onToggleDossier(); }} style={{ width: '100%' }}>{entry.in_dossier ? 'Remove from Chronicle' : 'Add to Chronicle'}</button></div>}
    </div></div>
  </div></>;
  if (!standalone) return body;
  return <div className="proto-root"><div className="proto-main">{body}</div></div>;
};
export default EntryView;
