import { useMemo, useState } from 'react';
import type { V2Person, V2RecordRelationship } from '@/chronicle/model/schema';
import { canonicalPersonWriter } from '@/chronicle/model/canonicalPersonWriter';
import { canonicalRelationshipWriter } from '@/chronicle/model/canonicalRelationshipWriter';

export const CanonicalPeopleEditor = ({ ownerId, recordId, people, relationships, onChanged }: {
  ownerId: string;
  recordId: string;
  people: readonly V2Person[];
  relationships: readonly V2RecordRelationship[];
  onChanged: () => Promise<void>;
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const relationByPerson = useMemo(() => new Map(
    relationships.filter(row => row.entity_type === 'person' && row.removed_at === null).map(row => [row.entity_id, row]),
  ), [relationships]);

  const add = async () => {
    const clean = name.trim();
    if (!clean || saving) return;
    setSaving(true);
    try {
      const person = await canonicalPersonWriter.ensure(ownerId, clean, role || null);
      await canonicalRelationshipWriter.add(ownerId, recordId, 'person', person.id, role || null);
      setName(''); setRole('');
      await onChanged();
    } finally { setSaving(false); }
  };

  return <section style={{ marginTop: 20 }}>
    <h2 className="proto-h2">People</h2>
    <p className="proto-help">People are linked as organisational details. Adding or removing a person never changes the sealed wording.</p>
    {people.length === 0 ? <div className="proto-empty">No people linked.</div> : people.map(person => {
      const relationship = relationByPerson.get(person.id);
      return <div className="proto-entry" key={person.id}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{person.display_name}</div>
        {(relationship?.role_note || person.role_note) && <div className="proto-help" style={{ marginTop: 3 }}>{relationship?.role_note || person.role_note}</div>}
        {relationship && <button className="proto-btn" data-variant="ghost" style={{ marginTop: 8 }} onClick={async () => { await canonicalRelationshipWriter.remove(ownerId, recordId, relationship.id); await onChanged(); }}>Remove link</button>}
      </div>;
    })}
    <div className="proto-entry" style={{ marginTop: 10 }}>
      <input className="proto-input" placeholder="Person name" value={name} onChange={e => setName(e.target.value)} />
      <input className="proto-input" style={{ marginTop: 8 }} placeholder="Role or relationship (optional)" value={role} onChange={e => setRole(e.target.value)} />
      <button className="proto-btn" data-variant="primary" style={{ width: '100%', marginTop: 8 }} disabled={!name.trim() || saving} onClick={() => { void add(); }}>Link person</button>
    </div>
  </section>;
};
