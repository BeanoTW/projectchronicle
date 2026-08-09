// Phase 8 — deterministic, production-shaped test datasets.
//
// No production content: every name, narrative and file name is synthetic.
// The generator is seeded, so 100/1,000/5,000-record runs are reproducible
// and comparable between machines and between test runs.

import type { V1Evidence, V1EditHistory, V1Note, V1Snapshot } from '../migrationPlan';

/** Small deterministic PRNG (mulberry32). */
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const CATEGORIES = ['Conduct', 'Workload', 'Communication', 'Process', 'Absence', null];
const PEOPLE = ['A. Fielding', 'B. Okoro', 'C. Marsh', 'D. Iqbal', 'E. Novak', 'F. Renwick'];
const LOCATIONS = ['Site office', 'Meeting room 2', 'Warehouse floor', 'Remote call', 'Corridor'];
const LOREM =
  'Recorded for personal reference. The exchange took place during the shift and was noted immediately afterwards. ';

const uid = (prefix: string, n: number) => `${prefix}-${String(n).padStart(6, '0')}`;

const pad = (n: number) => String(n).padStart(2, '0');

export interface ScaleDataset extends V1Snapshot {
  label: string;
}

/**
 * Builds a snapshot with a realistic mixture of incidents and daily records,
 * long narratives, clarifications, evidence (images, documents, voice),
 * inclusion state, and dates spread across several years.
 */
export const buildScaleDataset = (count: number, seed = 42): ScaleDataset => {
  const rand = rng(seed);
  const incidents: ScaleDataset['incidents'] = [];
  const notes: V1Note[] = [];
  const evidence: V1Evidence[] = [];
  const history: V1EditHistory[] = [];

  for (let i = 0; i < count; i += 1) {
    const r = rand();
    const year = 2022 + (i % 4);
    const month = (i % 12) + 1;
    const day = (i % 27) + 1;
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const createdAt = `${date}T${pad(6 + (i % 12))}:${pad(i % 60)}:00.000Z`;
    const isDaily = i % 7 === 0;
    const long = i % 11 === 0;
    const id = uid('rec', i);

    incidents.push({
      id,
      user_id: 'test-user',
      raw_narrative: i % 53 === 0 ? '' : LOREM.repeat(long ? 40 : 2) + `Reference ${i}.`,
      record_type: isDaily ? 'daily_record' : 'incident',
      incident_date: isDaily ? null : date,
      record_date: isDaily ? date : null,
      incident_time: i % 29 === 0 ? 'half past nine' : `${pad(8 + (i % 10))}:${pad((i * 7) % 60)}`,
      category: CATEGORIES[i % CATEGORIES.length],
      subtype: null,
      location: LOCATIONS[i % LOCATIONS.length],
      context_domain: 'workplace',
      title: i % 3 === 0 ? `Record ${i}` : null,
      created_at: createdAt,
      updated_at: createdAt,
      original_created_at: createdAt,
      excluded_from_rep: i % 3 !== 0,          // ~1/3 in My Record
      people_involved: [PEOPLE[i % PEOPLE.length], ...(i % 5 === 0 ? [PEOPLE[(i + 2) % PEOPLE.length]] : [])],
      witnesses: i % 9 === 0 ? [PEOPLE[(i + 1) % PEOPLE.length]] : [],
      record_method: i % 6 === 0 ? 'voice' : 'text',
      tags: [],
      status: 'Open',
      locked: false,
      severity: i % 13 === 0 ? 'High' : null,
      ai_summary: i % 17 === 0 ? 'Generated summary (not migrated).' : null,
      exact_words: null,
      impact_note: null,
      version: 1,
    });

    // Clarifications
    const clarCount = r < 0.2 ? 3 : r < 0.5 ? 1 : 0;
    for (let c = 0; c < clarCount; c += 1) {
      notes.push({
        id: uid(`note-${i}`, c),
        incident_id: id,
        note_text: long ? LOREM.repeat(10) : 'Follow-up noted the next working day.',
        note_type: c === 0 ? 'Update' : 'Outcome',
        created_at: `${date}T1${c}:00:00.000Z`,
      });
    }

    // Evidence (images, documents, voice)
    if (i % 4 === 0) {
      evidence.push({
        id: uid(`ev-${i}`, 0),
        incident_id: id,
        file_name: `photo-${i}.jpg`,
        file_path: `test/${id}/photo-${i}.jpg`,
        file_hash: i % 8 === 0 ? null : `hash${i}`,
        mime_type: 'image/jpeg',
        upload_date: createdAt,
      });
    }
    if (i % 6 === 0) {
      evidence.push({
        id: uid(`ev-${i}`, 1),
        incident_id: id,
        file_name: `note-${i}.pdf`,
        file_path: `test/${id}/note-${i}.pdf`,
        file_hash: `hash-doc-${i}`,
        mime_type: 'application/pdf',
        upload_date: createdAt,
      });
    }
    if (i % 6 === 0) {
      evidence.push({
        id: uid(`ev-${i}`, 2),
        incident_id: id,
        file_name: `voice-${i}.webm`,
        file_path: `test/${id}/voice-${i}.webm`,
        file_hash: `hash-voice-${i}`,
        mime_type: 'audio/webm',
        upload_date: createdAt,
      });
    }
    if (i % 10 === 0) {
      evidence.push({
        id: uid(`ev-${i}`, 3),
        incident_id: id,
        file_name: `unsupported-${i}.xyz`,
        file_path: `test/${id}/unsupported-${i}.xyz`,
        file_hash: null,
        mime_type: 'application/octet-stream',
        upload_date: createdAt,
      });
    }

    if (i % 5 === 0) {
      history.push({
        id: uid(`hist-${i}`, 0),
        incident_id: id,
        field_changed: 'category',
        changed_at: createdAt,
        edit_source: 'user',
      });
    }
  }

  // A few orphans, as older production data really contains.
  if (count >= 100) {
    notes.push({ id: 'note-orphan', incident_id: 'rec-999999', note_text: 'Orphan', note_type: 'Update', created_at: '2023-01-01T00:00:00.000Z' });
    evidence.push({ id: 'ev-orphan', incident_id: null, file_name: 'loose.png', file_path: 'test/loose.png', file_hash: null, mime_type: 'image/png', upload_date: '2023-01-01T00:00:00.000Z' });
    history.push({ id: 'hist-orphan', incident_id: 'rec-999999', field_changed: 'category', changed_at: '2023-01-01T00:00:00.000Z', edit_source: 'user' });
  }

  return { label: `${count} records`, incidents, notes, evidence, history };
};
