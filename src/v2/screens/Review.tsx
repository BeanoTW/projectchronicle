import { V2_BASE } from '../routes';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v2DB, type V2Entry } from '../db';
import EvidenceSection from '../media/EvidenceSection';

const ReviewScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<V2Entry | null>(null);
  const [category, setCategory] = useState('');
  const [context, setContext] = useState('');
  const [people, setPeople] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');

  useEffect(() => {
    if (!id) return;
    v2DB.entries.get(id).then(e => {
      if (!e) return;
      setEntry(e);
      setCategory(e.category ?? '');
      setContext(e.context ?? '');
      setPeople(e.people.join(', '));
      setEventDate(e.event_date ?? '');
      setEventTime(e.event_time ?? '');
    });
  }, [id]);

  if (!entry) return <p className="proto-help">Loading…</p>;

  const save = async () => {
    await v2DB.entries.update(entry.id, {
      category: category.trim() || null,
      context: context.trim() || null,
      people: people.split(',').map(p => p.trim()).filter(Boolean),
      event_date: eventDate || null,
      event_time: eventTime || null,
    });
    navigate(`${V2_BASE}/entry/${entry.id}`);
  };

  return (
    <div>
      <h1 className="proto-h1">Add details</h1>
      <p className="proto-help" style={{ marginBottom: 16 }}>
        Optional. The original wording is already sealed and will not change.
      </p>

      <label className="proto-help" style={{ display: 'block', marginBottom: 4 }}>Category</label>
      <input className="proto-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Bullying, Exclusion" />

      <label className="proto-help" style={{ display: 'block', marginTop: 12, marginBottom: 4 }}>Context</label>
      <input className="proto-input" value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Team meeting, Email" />

      <label className="proto-help" style={{ display: 'block', marginTop: 12, marginBottom: 4 }}>People (comma separated)</label>
      <input className="proto-input" value={people} onChange={e => setPeople(e.target.value)} placeholder="e.g. Line manager, Sam" />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="proto-help" style={{ display: 'block', marginBottom: 4 }}>Event date</label>
          <input className="proto-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="proto-help" style={{ display: 'block', marginBottom: 4 }}>Event time</label>
          <input className="proto-input" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
        </div>
      </div>

      <EvidenceSection entryId={entry.id} />

      <div className="proto-actions-row" style={{ marginTop: 20 }}>
        <button className="proto-btn" data-variant="primary" onClick={save}>Save details</button>
        <button className="proto-btn" onClick={() => navigate(V2_BASE + '/notebook')}>Skip</button>
      </div>
    </div>
  );
};

export default ReviewScreen;
