// Dev-only seed for the sanitised real-case demo dataset (17 records).
// STRICT: narratives, dates, people, locations, subtypes preserved exactly
// as provided in the source spec. No AI summaries, no inferred fields.
//
// Triggered from the hidden Developer Controls panel only.

import { localDB, isBackupEnabled, type LocalIncident, type SyncState } from '@/local/db';
import { supabase } from '@/integrations/supabase/client';
import type { PrimaryCategory } from '@/lib/categories';

// Map spec category labels onto the app's PrimaryCategory model.
// Where the spec uses a label that does not exist in our model, we map by
// intent and never invent a new category. "Customer interaction" has no
// equivalent — we use 'Other' as instructed by the spec ("do not invent").
const mapCategory = (specCategory: string | null): PrimaryCategory | null => {
  if (!specCategory) return null;
  switch (specCategory) {
    case 'Communication': return 'Communication';
    case 'Written': return 'Record Issued';
    case 'Health':
    case 'Health & Safety': return 'Working Conditions';
    case 'Conduct': return 'Observed Behaviour';
    case 'Customer interaction': return 'Other';
    default: return 'Other';
  }
};

interface SpecRecord {
  date: string;            // ISO yyyy-mm-dd
  category: string | null; // spec label (verbatim)
  subtype: string | null;  // spec label (verbatim)
  location: string;
  people: string[];
  narrative: string;
  recordType: 'incident' | 'daily_record';
  displayNote?: string;    // representative-date annotation, where applicable
}

// Records 1–17, in spec order.
const SPEC_RECORDS: SpecRecord[] = [
  {
    date: '2026-01-02',
    category: 'Communication',
    subtype: 'Verbal meeting',
    location: 'workplace',
    people: ['Employee A', 'Employee B', 'Manager A', 'Manager B'],
    narrative: 'During a meeting regarding timekeeping and absences, we were told we had received multiple verbal warnings. This was the first time these warnings had been mentioned to us. No written record of any prior disciplinary action was provided at or before the meeting.',
    recordType: 'incident',
  },
  {
    date: '2026-03-07',
    category: 'Written',
    subtype: 'Formal communication',
    location: 'workplace',
    people: ['Employee A', 'Employee B', 'Manager B'],
    narrative: 'A written warning was received relating to timekeeping and absences that had previously been discussed in the January meeting. The warning referred to prior verbal warnings, which we had no prior knowledge of and which had not been formally recorded before this point.',
    recordType: 'incident',
  },
  {
    date: '2026-01-02',
    category: 'Communication',
    subtype: 'Verbal comment',
    location: 'workplace',
    people: ['Employee A', 'Manager A'],
    narrative: 'During the same January meeting, Manager A stated that Employee A was using the workplace to sell dogs. This was not accurate. Employee A has previously spoken about involvement in fostering rescue dogs but has never conducted any business activity at work. The accusation was made without evidence and felt personal and targeted.',
    recordType: 'incident',
  },
  {
    date: '2026-01-02',
    category: 'Communication',
    subtype: 'Verbal comment',
    location: 'workplace',
    people: ['Employee A', 'Employee B', 'Manager A'],
    narrative: 'During the same January meeting, Manager A described Employee A and Employee B as cliquey.',
    recordType: 'incident',
  },
  {
    date: '2026-01-02',
    category: 'Communication',
    subtype: 'Verbal comment',
    location: 'workplace',
    people: ['Employee B', 'Manager B'],
    narrative: 'During the same January meeting, Manager B stated that Employee B should have been assigned to cover a different work location because he is male and would therefore have the correct equipment. In reality, Employee B was not appropriately equipped for that location on that day, and Employee A was.',
    recordType: 'incident',
  },
  {
    date: '2026-04-05',
    category: 'Communication',
    subtype: 'Verbal comment',
    location: 'workplace',
    people: ['Employee B', 'Manager B'],
    narrative: 'During a discussion about workplace concerns raised by Employee A, Manager B responded by stating that no one sees Employee B as coloured. The comment was made in response to a concern that Employee B may be experiencing unfair treatment connected to his identity. The response was experienced as dismissive and as a denial of identity rather than an engagement with the concern raised.',
    recordType: 'incident',
  },
  {
    date: '2026-03-15',
    category: 'Communication',
    subtype: 'Verbal behaviour',
    location: 'workplace',
    people: ['Employee A', 'Employee B'],
    narrative: 'On multiple occasions across the working period, colleagues were overheard making repeated comments mockingly referring to the number of non-white guests present at the workplace on a given day. These remarks were made in a joking tone. On at least one occasion, Employee A and Employee B were directly invited to participate. They declined through non-engagement. Employee B is mixed-race. The remarks were experienced as dehumanising and created an alienating working environment.',
    recordType: 'incident',
    displayNote: 'Multiple dates — representative date used',
  },
  {
    date: '2026-07-05',
    category: 'Health & Safety',
    subtype: 'Workplace condition',
    location: 'workplace',
    people: ['Employee A', 'Manager A'],
    narrative: 'Employee A informed her line manager of a pregnancy. Management indicated they had already been informally aware for approximately two weeks prior to this date. No immediate steps were taken to assess risk or offer adjusted duties. During this conversation, Manager A asked when Employee A would be starting maternity leave, stated that pregnancy had not been that bad for her personally, and implied Employee A was overstating the difficulty. No congratulations or formal acknowledgement of the pregnancy were offered. Employee A had already been experiencing symptoms including nausea, dizziness, and low blood pressure prior to this disclosure.',
    recordType: 'incident',
  },
  {
    date: '2026-07-11',
    category: 'Health & Safety',
    subtype: 'Workplace condition',
    location: 'workplace',
    people: ['Employee A', 'Manager B'],
    narrative: 'Employee A sent a written message formally confirming pregnancy and describing symptoms: persistent nausea, very low blood pressure, dizziness when standing for extended periods, and sensitivity to cooking smells in the working environment. No formal adjusted duties or written support plan was produced in response. A suggestion was made verbally that a stool could be used at the counter. No further follow-up or written record of this suggestion was provided. Employee A continued working long shifts in the same environment without additional breaks, task reassignment, or written safety accommodations.',
    recordType: 'incident',
  },
  {
    date: '2026-07-20',
    category: 'Health & Safety',
    subtype: 'Workplace condition',
    location: 'workplace',
    people: ['Employee A'],
    narrative: 'A pregnancy risk assessment was completed, approximately six weeks after management became informally aware of the pregnancy and approximately fifteen days after formal written disclosure. Prior to the assessment being arranged, Employee A was asked to provide a hand-written note confirming the pregnancy, which is not a legal requirement and created an additional barrier to accessing support. Employee A continued working in the same environment and under the same conditions throughout this period. No practical adjustments to duties or environment were implemented following the assessment.',
    recordType: 'incident',
  },
  {
    date: '2026-07-05',
    category: 'Communication',
    subtype: 'Verbal comment',
    location: 'workplace',
    people: ['Employee A', 'Manager A'],
    narrative: 'Approximately twenty to thirty minutes after Employee A disclosed her pregnancy, Manager A made a comment within earshot of staff stating words to the effect that if she herself became pregnant again she would kill herself. This comment followed a pattern of dismissive responses to the pregnancy disclosure earlier in the same conversation, including minimising the difficulty of pregnancy by reference to her own experience and implying Employee A should have disclosed sooner. Hearing this comment in that context was experienced as distressing.',
    recordType: 'incident',
  },
  {
    date: '2026-07-11',
    category: 'Communication',
    subtype: 'Verbal comment',
    location: 'workplace',
    people: ['Employee A', 'Manager B'],
    narrative: "During a conversation in which Employee A described her pregnancy-related symptoms and health difficulties, Manager B made comments to the effect that Employee A might not be fit enough to work there and that she should consider signing on. These comments were made after Employee A had already sought medical advice regarding her condition.",
    recordType: 'incident',
  },
  {
    date: '2026-07-19',
    category: 'Conduct',
    subtype: 'Interaction with staff',
    location: 'workplace',
    people: ['Employee B', 'Manager C'],
    narrative: 'Manager C entered the kitchen area and approached Employee B while he was serving customers. Manager C repeatedly asked who had told Employee B something, in an elevated and confrontational tone, in front of other staff and customers. Employee B indicated he did not want to have the conversation during service. The discussion continued regardless.',
    recordType: 'incident',
  },
  {
    date: '2026-07-26',
    category: 'Communication',
    subtype: 'Verbal comment',
    location: 'workplace',
    people: ['Employee A', 'Employee B', 'Manager C'],
    narrative: 'Manager C stated, during a conversation with Employee B while customers were being served, that if multiple staff members were raising concerns, this pointed toward Employee A and Employee B being the cause. The comment was experienced as scapegoating. Employee B indicated the conversation should take place at another time. The discussion continued. Employee A was informed of the comments shortly afterwards, which significantly increased her distress at a point when she was already physically unwell.',
    recordType: 'incident',
  },
  {
    date: '2026-07-25',
    category: 'Customer interaction',
    subtype: 'Allergen handling',
    location: 'workplace',
    people: ['Employee B'],
    narrative: 'A customer approached the till and asked whether a dish contained a specific allergen due to a dietary concern. Employee B checked with kitchen staff, who stated clearly that the allergen was not present. This information was passed to the customer. The customer was subsequently served and had eaten before Employee B became aware that kitchen staff had in fact prepared two versions of the dish and were uncertain which had been served. Neither kitchen staff member knew which version the customer had received. The customer appeared unharmed. The incident represented a clear failure of allergen communication that placed the customer at risk.',
    recordType: 'incident',
  },
  {
    // Record 16 — Daily Record. No category/subtype.
    date: '2026-07-25',
    category: null,
    subtype: null,
    location: 'workplace',
    people: [],
    narrative: 'Worked a full shift while experiencing active pregnancy symptoms including repeated vomiting, dizziness, and urinary incontinence caused by the severity of sickness. Required a change of clothing during the shift. Remained at the counter between episodes in order to keep the café operational. Only three staff were present. No adjusted duties were offered. Continued working after changing clothes. Left work the following day and did not return.',
    recordType: 'daily_record',
  },
  {
    date: '2026-06-01',
    category: 'Customer interaction',
    subtype: 'External complaint context',
    location: 'workplace',
    people: ['Manager C'],
    narrative: 'A customer was using an electrical outlet at the premises with the knowledge and prior encouragement of a member of staff. The following day, Manager C approached the customer in a public setting, in front of staff and other customers, and accused her of stealing from the company. The customer appeared to have a health condition. The approach was experienced by those present as aggressive and disproportionate. The member of staff who had originally encouraged the customer to use the outlet intervened and took responsibility.',
    recordType: 'incident',
  },
];

export interface RealCaseSeedResult {
  totalCreated: number;
  incidents: number;
  dailyRecords: number;
}

// Strip local-only metadata before pushing to Supabase.
function toCloud(row: LocalIncident): Record<string, unknown> {
  const {
    owner_user_id: _o,
    sync_state: _s,
    last_sync_attempt_at: _a,
    last_sync_error: _e,
    local_updated_at: _l,
    ...cloud
  } = row;
  return cloud;
}

export async function wipeAndSeedRealCaseDataset(userId: string): Promise<RealCaseSeedResult> {
  if (!userId) throw new Error('No user');

  // 1. Wipe LOCAL Dexie for this owner (incidents + follow-up notes).
  await localDB.transaction('rw', localDB.incidents, localDB.follow_up_notes, async () => {
    const localIds = await localDB.incidents
      .where('owner_user_id').equals(userId).primaryKeys();
    if (localIds.length) await localDB.incidents.bulkDelete(localIds);
    const noteIds = await localDB.follow_up_notes
      .where('owner_user_id').equals(userId).primaryKeys();
    if (noteIds.length) await localDB.follow_up_notes.bulkDelete(noteIds);
  });

  // 2. Wipe CLOUD for this user (RLS scopes to current auth user).
  await supabase.from('edit_history').delete().eq('user_id', userId);
  await supabase.from('follow_up_notes').delete().eq('user_id', userId);
  const { data: evRows } = await supabase
    .from('evidence_files').select('file_path').eq('user_id', userId);
  if (evRows && evRows.length > 0) {
    await supabase.storage.from('evidence').remove(evRows.map(e => e.file_path));
    await supabase.from('evidence_files').delete().eq('user_id', userId);
  }
  await supabase.from('incidents').delete().eq('user_id', userId);

  // 3. Build the dataset.
  const enabled = await isBackupEnabled();
  const syncState: SyncState = enabled ? 'queued' : 'local_only';

  const localRows: LocalIncident[] = SPEC_RECORDS.map((spec, idx) => {
    const id = crypto.randomUUID();
    // Stable per-record creation timestamp anchored to the spec date so
    // ordering in the timeline matches the chronology. Add a per-index
    // offset (in seconds) so records sharing the same date keep stable
    // creation order matching the spec list.
    const ts = new Date(`${spec.date}T09:00:${String(idx).padStart(2, '0')}Z`).toISOString();
    const mappedCat = mapCategory(spec.category);
    const isDaily = spec.recordType === 'daily_record';

    // Spec subtypes are not always in our SUBTYPES allowlist for the mapped
    // category. We store them verbatim because `subtype` is a free-text
    // column and the spec requires exact preservation.
    const subtype = isDaily ? null : spec.subtype;

    // Append the display note (representative-date annotation) as an
    // appended note inside `impact_note` since the data model has no
    // dedicated display-annotation field. This satisfies the spec's
    // fallback rule for Record 7.
    const impactNote = spec.displayNote ?? null;

    return {
      id,
      user_id: userId,
      record_type: spec.recordType,
      incident_date: spec.date,
      record_date: isDaily ? spec.date : null,
      incident_time: null,
      location: spec.location,
      people_involved: spec.people,
      witnesses: [],
      category: isDaily ? null : mappedCat,
      category_source: 'user',
      subtype,
      severity: null,
      impact_note: impactNote,
      raw_narrative: spec.narrative,
      ai_summary: null,
      exact_words: null,
      tags: [],
      status: 'Open',
      locked: false,
      excluded_from_rep: false,
      record_method: 'text',
      title: null,
      context_domain: 'Workplace',
      interactions: null,
      void_reason: null,
      voided_at: null,
      created_at: ts,
      updated_at: ts,
      original_created_at: ts,
      last_modified_at: ts,
      transcription_source_attachment_id: null,
      transcription_created_at: null,
      transcription_provider: null,
      transcription_model: null,
      version: 1,
      owner_user_id: userId,
      sync_state: syncState,
      last_sync_attempt_at: null,
      last_sync_error: null,
      local_updated_at: ts,
    };
  });

  // 4. Insert into Dexie (source of truth).
  await localDB.incidents.bulkPut(localRows);

  // 5. If backup is ON, push to cloud.
  if (enabled) {
    const cloudRows = localRows.map(toCloud);
    const chunkSize = 25;
    for (let i = 0; i < cloudRows.length; i += chunkSize) {
      const slice = cloudRows.slice(i, i + chunkSize);
      const { error } = await supabase.from('incidents').insert(slice as never);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[devSeedRealCase] cloud insert chunk failed', error.message);
      }
    }
    await localDB.incidents.bulkPut(
      localRows.map(r => ({ ...r, sync_state: 'backed_up' as SyncState })),
    );
  }

  return {
    totalCreated: localRows.length,
    incidents: localRows.filter(r => r.record_type === 'incident').length,
    dailyRecords: localRows.filter(r => r.record_type === 'daily_record').length,
  };
}
