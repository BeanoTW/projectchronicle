import { useMemo, useState } from 'react';
import type { EventDateValue, OrganisationalDetails } from '@/chronicle/model/schema';

interface Props {
  details: OrganisationalDetails;
  onCancel: () => void;
  onSave: (patch: Partial<Omit<OrganisationalDetails, 'revision_count'>>) => Promise<void>;
}

const dateMode = (value: EventDateValue | null): 'none' | EventDateValue['kind'] => value?.kind ?? 'none';

export const CanonicalDetailsEditor = ({ details, onCancel, onSave }: Props) => {
  const [title, setTitle] = useState(details.title ?? '');
  const [category, setCategory] = useState(details.category_id ?? '');
  const [context, setContext] = useState(details.context ?? '');
  const [location, setLocation] = useState(details.location ?? '');
  const [time, setTime] = useState(details.event_time ?? '');
  const [mode, setMode] = useState<'none' | EventDateValue['kind']>(dateMode(details.event_date));
  const [date, setDate] = useState(details.event_date && 'date' in details.event_date ? details.event_date.date : '');
  const [start, setStart] = useState(details.event_date?.kind === 'range' ? details.event_date.start : '');
  const [end, setEnd] = useState(details.event_date?.kind === 'range' ? details.event_date.end : '');
  const [daypart, setDaypart] = useState(details.event_date?.kind === 'approximate' ? details.event_date.daypart ?? '' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventDate = useMemo<EventDateValue | null>(() => {
    if (mode === 'none') return null;
    if (mode === 'unknown') return { kind: 'unknown' };
    if (mode === 'range') return start && end ? { kind: 'range', start, end } : null;
    if (!date) return null;
    return mode === 'approximate'
      ? { kind: 'approximate', date, daypart: daypart ? daypart as 'morning' | 'afternoon' | 'evening' | 'night' : null }
      : { kind: 'exact', date };
  }, [mode, date, start, end, daypart]);

  const save = async () => {
    if ((mode === 'exact' || mode === 'approximate') && !date) { setError('Choose a date or change the date precision.'); return; }
    if (mode === 'range' && (!start || !end)) { setError('Choose both ends of the date range.'); return; }
    if (mode === 'range' && start > end) { setError('The date range cannot end before it starts.'); return; }
    setSaving(true); setError(null);
    try {
      await onSave({
        title: title.trim() || null,
        category_id: category.trim() || null,
        context: context.trim() || null,
        location: location.trim() || null,
        event_date: eventDate,
        event_time: time || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save details.');
    } finally { setSaving(false); }
  };

  return <section className="proto-entry" style={{ marginTop: 10 }} aria-label="Edit organisational details">
    <div className="proto-field"><label>Title</label><input className="proto-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
    <div className="proto-field"><label>Category</label><input className="proto-input" value={category} onChange={e => setCategory(e.target.value)} /></div>
    <div className="proto-field"><label>Context</label><input className="proto-input" value={context} onChange={e => setContext(e.target.value)} /></div>
    <div className="proto-field"><label>Location</label><input className="proto-input" value={location} onChange={e => setLocation(e.target.value)} /></div>
    <div className="proto-field"><label>Date precision</label><select className="proto-input" value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="none">Not set</option><option value="exact">Exact date</option><option value="approximate">Approximate date</option><option value="range">Date range</option><option value="unknown">Unknown</option></select></div>
    {(mode === 'exact' || mode === 'approximate') && <div className="proto-field"><label>Date</label><input className="proto-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>}
    {mode === 'approximate' && <div className="proto-field"><label>Daypart (optional)</label><select className="proto-input" value={daypart} onChange={e => setDaypart(e.target.value)}><option value="">Not specified</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="night">Night</option></select></div>}
    {mode === 'range' && <><div className="proto-field"><label>From</label><input className="proto-input" type="date" value={start} onChange={e => setStart(e.target.value)} /></div><div className="proto-field"><label>To</label><input className="proto-input" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div></>}
    <div className="proto-field"><label>Time (optional)</label><input className="proto-input" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
    <p className="proto-help">These fields organise the record only. The sealed wording above is never edited.</p>
    {error && <p className="proto-help" role="alert">{error}</p>}
    <div className="proto-actions-row"><button className="proto-btn" data-variant="ghost" disabled={saving} onClick={onCancel}>Cancel</button><button className="proto-btn" data-variant="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save details'}</button></div>
  </section>;
};
