import { useMemo, useState } from 'react';
import type { V2Organisation, V2RecordRelationship } from '@/chronicle/model/schema';
import { canonicalOrganisationWriter } from '@/chronicle/model/canonicalOrganisationWriter';
import { canonicalRelationshipWriter } from '@/chronicle/model/canonicalRelationshipWriter';

export const CanonicalOrganisationEditor = ({ ownerId, recordId, organisations, relationships, onChanged }: {
  ownerId: string;
  recordId: string;
  organisations: readonly V2Organisation[];
  relationships: readonly V2RecordRelationship[];
  onChanged: () => Promise<void>;
}) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const relationByOrganisation = useMemo(() => new Map(
    relationships.filter(row => row.entity_type === 'organisation' && row.removed_at === null).map(row => [row.entity_id, row]),
  ), [relationships]);

  const add = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const organisation = await canonicalOrganisationWriter.ensure(ownerId, name, note || null);
      await canonicalRelationshipWriter.add(ownerId, recordId, 'organisation', organisation.id, note || null);
      setName(''); setNote('');
      await onChanged();
    } finally { setSaving(false); }
  };

  return <section style={{ marginTop: 20 }}>
    <h2 className="proto-h2">Organisations</h2>
    <p className="proto-help">Organisation links are organisational details only. They never alter the sealed wording.</p>
    {organisations.length === 0 ? <div className="proto-empty">No organisations linked.</div> : organisations.map(item => {
      const relationship = relationByOrganisation.get(item.id);
      return <div className="proto-entry" key={item.id}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{item.display_name}</div>
        {(relationship?.role_note || item.note) && <div className="proto-help" style={{ marginTop: 3 }}>{relationship?.role_note || item.note}</div>}
        {relationship && <button className="proto-btn" data-variant="ghost" style={{ marginTop: 8 }} onClick={async () => { await canonicalRelationshipWriter.remove(ownerId, recordId, relationship.id); await onChanged(); }}>Remove link</button>}
      </div>;
    })}
    <div className="proto-entry" style={{ marginTop: 10 }}>
      <input className="proto-input" placeholder="Organisation name" value={name} onChange={e => setName(e.target.value)} />
      <input className="proto-input" style={{ marginTop: 8 }} placeholder="Context or role (optional)" value={note} onChange={e => setNote(e.target.value)} />
      <button className="proto-btn" data-variant="primary" style={{ width: '100%', marginTop: 8 }} disabled={!name.trim() || saving} onClick={() => { void add(); }}>Link organisation</button>
    </div>
  </section>;
};
