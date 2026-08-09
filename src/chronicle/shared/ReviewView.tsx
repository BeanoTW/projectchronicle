// Phase 6C — source-agnostic review ("Add details") view.
// Optional metadata only. Never touches original wording, sealed timestamp,
// original voice or original attachments.
import { useState } from 'react';
import { parsePeople, type ReviewDetails } from './captureModel';

interface Props {
  initial: ReviewDetails;
  onSave: (details: ReviewDetails) => Promise<void>;
  onSkip: () => void;
  /** Rendered under the fields — e.g. the source's evidence section. */
  children?: React.ReactNode;
  saveLabel?: string;
}

const ReviewView = ({ initial, onSave, onSkip, children, saveLabel = 'Save details' }: Props) => {
  const [category, setCategory] = useState(initial.category ?? '');
  const [context, setContext] = useState(initial.context ?? '');
  const [people, setPeople] = useState(initial.people.join(', '));
  const [eventDate, setEventDate] = useState(initial.eventDate ?? '');
  const [eventTime, setEventTime] = useState(initial.eventTime ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        category: category.trim() || null,
        context: context.trim() || null,
        people: parsePeople(people),
        eventDate: eventDate || null,
        eventTime: eventTime || null,
      });
    } catch (e) {
      // The sealed record is untouched and still accessible.
      setError(
        `${(e as Error)?.message ?? 'These details could not be saved.'} ` +
        'Your sealed record is unaffected — you can try again, or continue without details.',
      );
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="proto-h1">Add details</h1>
      <p className="proto-help" style={{ marginBottom: 16 }}>
        Optional. The original wording is already sealed and will not change.
      </p>

      <label className="proto-help" htmlFor="rv-category" style={{ display: 'block', marginBottom: 4 }}>Category</label>
      <input id="rv-category" className="proto-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Bullying, Exclusion" />

      <label className="proto-help" htmlFor="rv-context" style={{ display: 'block', marginTop: 12, marginBottom: 4 }}>Context</label>
      <input id="rv-context" className="proto-input" value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Team meeting, Email" />

      <label className="proto-help" htmlFor="rv-people" style={{ display: 'block', marginTop: 12, marginBottom: 4 }}>People (comma separated)</label>
      <input id="rv-people" className="proto-input" value={people} onChange={e => setPeople(e.target.value)} placeholder="e.g. Line manager, Sam" />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="proto-help" htmlFor="rv-date" style={{ display: 'block', marginBottom: 4 }}>Event date</label>
          <input id="rv-date" className="proto-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="proto-help" htmlFor="rv-time" style={{ display: 'block', marginBottom: 4 }}>Event time</label>
          <input id="rv-time" className="proto-input" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
        </div>
      </div>

      {children}

      {error && <p className="proto-media-error" role="alert">{error}</p>}

      <div className="proto-actions-row" style={{ marginTop: 20 }}>
        <button className="proto-btn" data-variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </button>
        <button className="proto-btn" onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
};

export default ReviewView;
